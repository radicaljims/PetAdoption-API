var Database = require('../../../core/mongodb/default'),
    ModelFactory = require('../../../core/mongodb/lib/model-factory'),
    Debuggable = require('../../../core/lib/debuggable');

describe('Database', function () {
    var dbInstance,
        TestSchema = {test: String};

    beforeAll(function () {
        dbInstance = new Database(new ModelFactory('test', TestSchema));
    });

    afterEach(function (done) {
        dbInstance.stop(function () {
            done()
        });
    });

    describe("exec()", function () {

        it("executes a function when db is ready", function (done) {
            dbInstance.exec(function () {
                done();
            });
        })
    });
});
