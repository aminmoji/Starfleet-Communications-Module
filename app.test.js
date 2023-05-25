const mongoose = require("mongoose");

describe("Database Connection Test", () => {
  beforeAll(() => {
    // Load environment variables
    require("dotenv").config();

    // Connect to the MongoDB database
    mongoose.connect(process.env.DATABASE_URL);
  });

  afterAll(async () => {
    // Close the database connection
    await mongoose.connection.close();
  });

  it("should connect to the database", (done) => {
    // Listen for the "connected" event
    mongoose.connection.once("connected", () => {
      done();
    });
  });

  //   it("should log an error if the database connection fails", (done) => {
  //     // Simulate a connection error
  //     mongoose.connection.emit("error", new Error("Connection error"));

  //     // Listen for the error event and verify the console log message
  //     console.log = jest.fn((message) => {
  //       expect(message).toContain("Connection error LCARS Down");
  //       done();
  //     });
  //   });

  //   it("should log when the database is disconnected", (done) => {

  //     mongoose.connection.emit("disconnected");

  //     console.log = jest.fn((message) => {
  //       expect(message).toBe("LCARS Disconnected");
  //       done();
  //     });
  //   });
});
