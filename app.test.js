const mongoose = require("mongoose");

describe("Database Connection Test", () => {
  beforeAll(() => {
    require("dotenv").config();

    mongoose.connect(
      "mongodb+srv://aminmoj:QvSPRlz7t50VVi9Q@cluster0.f4gxajs.mongodb.net/StarFleet_Comm_Module?retryWrites=true&w=majority"
    );
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  it("should connect to the database", (done) => {
    mongoose.connection.once("connected", () => {
      done();
    });
  });

  //   it("should log an error if the database connection fails", (done) => {
  //     mongoose.connection.emit("error", new Error("Connection error"));

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
