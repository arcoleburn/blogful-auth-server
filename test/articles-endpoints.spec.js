'use strict';
const knex = require('knex');
const supertest = require('supertest');
const app = require('../src/app');
const helpers = require('./test-helpers');

describe('Articles Endpoints', function () {
  let db;

  const {
    testUsers,
    testArticles,
    testComments,
  } = helpers.makeArticlesFixtures();
  function makeAuthHeader(user) {
    const token = Buffer.from(
      `${user.user_name}:${user.password}`
    ).toString('base64');
    return `Basic ${token}`;
  }
  before('make knex instance', () => {
    db = knex({
      client: 'pg',
      connection: process.env.TEST_DB_URL,
    });
    app.set('db', db);
  });

  after('disconnect from db', () => db.destroy());

  before('cleanup', () => helpers.cleanTables(db));

  afterEach('cleanup', () => helpers.cleanTables(db));

  describe('protected endpoints', () => {
    beforeEach('insert articles', () =>
      helpers.seedArticlesTables(
        db,
        testUsers,
        testArticles,
        testComments
      )
    );
    describe(' protected GET /api/articles/articleid', () => {
      it('responds with 401 missing basic token when no token present', () => {
        return supertest(app)
          .get('/api/articles/123')
          .expect(401, { error: 'missing basic token' });
      });
      it('responds 401 unauthorized req when no credentials', () => {
        const userNoCreds = { user_name: '', password: '' };
        return supertest(app)
          .get('/api/articles/123')
          .set('Authorization', makeAuthHeader(userNoCreds))
          .expect(401, { error: 'unauthorized request' });
      });
      it('responds 401 unauthorized when invalid username', () => {
        const userInvalidCreds = {
          user_name: 'user-not',
          password: 'existy',
        };
        return supertest(app)
          .get('/api/articles/1')
          .set('Authorization', makeAuthHeader(userInvalidCreds))
          .expect(401, { error: 'unauthorized request' });
      });
    });
  });
  describe(`GET /api/articles`, () => {
    context(`Given no articles`, () => {
      it(`responds with 200 and an empty list`, () => {
        return supertest(app).get('/api/articles').expect(200, []);
      });
    });

    context('Given there are articles in the database', () => {
      beforeEach('insert articles', () =>
        helpers.seedArticlesTables(
          db,
          testUsers,
          testArticles,
          testComments
        )
      );

      it('responds with 200 and all of the articles', () => {
        const expectedArticles = testArticles.map((article) =>
          helpers.makeExpectedArticle(
            testUsers,
            article,
            testComments
          )
        );
        return supertest(app)
          .get('/api/articles')
          .set('Authorization', makeAuthHeader(testUsers[0]))
          .expect(200, expectedArticles);
      });
    });

    context(`Given an XSS attack article`, () => {
      const testUser = helpers.makeUsersArray()[1];
      const {
        maliciousArticle,
        expectedArticle,
      } = helpers.makeMaliciousArticle(testUser);

      beforeEach('insert malicious article', () => {
        return helpers.seedMaliciousArticle(
          db,
          testUser,
          maliciousArticle
        );
      });

      it('removes XSS attack content', () => {
        return supertest(app)
          .get(`/api/articles`)
          .set('Authorization', makeAuthHeader(testUsers[0]))
          .expect(200)
          .expect((res) => {
            expect(res.body[0].title).to.eql(expectedArticle.title);
            expect(res.body[0].content).to.eql(
              expectedArticle.content
            );
          });
      });
    });
  });

  describe(`GET /api/articles/:article_id`, () => {
    context(`Given no articles`, () => {
      beforeEach(() => db.into('blogful_users').insert(testUsers));
      it(`responds with 404`, () => {
        const articleId = 123456;
        return supertest(app)
          .get(`/api/articles/${articleId}`)

          .set('Authorization', makeAuthHeader(testUsers[0]))
          .expect(404, { error: `Article doesn't exist` });
      });
    });

    context('Given there are articles in the database', () => {
      beforeEach('insert articles', () =>
        helpers.seedArticlesTables(
          db,
          testUsers,
          testArticles,
          testComments
        )
      );

      it('responds with 200 and the specified article', () => {
        const articleId = 2;
        const expectedArticle = helpers.makeExpectedArticle(
          testUsers,
          testArticles[articleId - 1],
          testComments
        );

        return supertest(app)
          .get(`/api/articles/${articleId}`)
          .set('Authorization', makeAuthHeader(testUsers[0]))
          .expect(200, expectedArticle);
      });
    });

    context(`Given an XSS attack article`, () => {
      const testUser = helpers.makeUsersArray()[1];
      const {
        maliciousArticle,
        expectedArticle,
      } = helpers.makeMaliciousArticle(testUser);

      beforeEach('insert malicious article', () => {
        return helpers.seedMaliciousArticle(
          db,
          testUser,
          maliciousArticle
        );
      });

      it('removes XSS attack content', () => {
        return supertest(app)
          .get(`/api/articles/${maliciousArticle.id}`)
          .set('Authorization', makeAuthHeader(testUser))
          .expect(200)
          .expect((res) => {
            expect(res.body.title).to.eql(expectedArticle.title);
            expect(res.body.content).to.eql(expectedArticle.content);
          });
      });
    });
  });

  describe(`GET /api/articles/:article_id/comments`, () => {
    context(`Given no articles`, () => {
      it(`responds with 404`, () => {
        const articleId = 123456;
        return supertest(app)
          .get(`/api/articles/${articleId}/comments`)
          .set(
            'Authorization',
            makeAuthHeader(helpers.makeUsersArray()[0])
          )
          .expect(404, { error: `Article doesn't exist` });
      });
    });

    context(
      'Given there are comments for article in the database',
      () => {
        beforeEach('insert articles', () =>
          helpers.seedArticlesTables(
            db,
            testUsers,
            testArticles,
            testComments
          )
        );

        it.only('responds with 200 and the specified comments', () => {
          const articleId = 1;
          const expectedComments = helpers.makeExpectedArticleComments(
            testUsers,
            articleId,
            testComments
          );

          return supertest(app)
            .get(`/api/articles/${articleId}/comments`)
            .set('Authorization', makeAuthHeader(testUsers[0]))
            .expect(200, expectedComments);
        });
      }
    );
  });
});
