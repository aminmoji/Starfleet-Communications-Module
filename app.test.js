const mongoose = require("mongoose");

require("dotenv").config();

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase("Database Connection Test", () => {
  beforeAll(async () => {
    await mongoose.connect(testDatabaseUrl);
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  it("should connect to the database", () => {
    expect(mongoose.connection.readyState).toBe(1);
  });
});
