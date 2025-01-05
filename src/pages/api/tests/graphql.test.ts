import { Db, MongoClient } from "mongodb";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { apiResolvers } from "../graphql";

vi.mock("mongodb");

let db: Db;

beforeEach(() => {
  vi.clearAllMocks();
  // @ts-ignore because we know this is mocked
  db = new MongoClient().db();
});

describe("GraphQL API", () => {
    it("should fetch collections", async () => {
        const mockCollections = [{ name: "users" }, { name: "products" }];
        vi.mocked(db.listCollections().toArray).mockResolvedValue(mockCollections);
    
        const result = await apiResolvers.Query.collections();
    
        expect(result).toEqual([{ name: "users" }, { name: "products" }]);
      });
    
      it("should fetch schema for a collection with primitive types", async () => {
        const sampleDoc = { name: "test", age: 30, active: true };
        vi.mocked(db.collection("users").findOne).mockResolvedValue(sampleDoc);
    
        const result = await apiResolvers.Query.schema(null, { collectionName: "users" });
    
        expect(result).toEqual([
          { name: "name", type: "string" },
          { name: "age", type: "number" },
          { name: "active", type: "boolean" },
        ]);
      });

  it("should return an empty array if document is not found", async () => {

    // Arrange
    (db.collection as any).mockReturnValue({ findOne: vi.fn().mockResolvedValue(null) });

    // Act
    const result = await apiResolvers.Query.schema(null, { collectionName: "users" });

    // Assert
    expect(result).toEqual([]);
  });

  it("should fetch data for a given collection and fields", async () => {

    // Arrange
    const data = [{ name: "John Doe", age: 30 }, { name: "Jane Doe", age: 25 }];
    (db.collection as any).mockReturnValue({
      find: vi.fn(() => ({ toArray: vi.fn().mockResolvedValue(data) })),
    });
    const args = { collectionName: "users", fields: ["name", "age"] };

    // Act
    const result = await apiResolvers.Query.data(null, args);

    // Assert
    expect(result).toEqual(data);
  });


  it("should handle invalid input for data query", async () => {

    // Arrange
    const args = { collectionName: 123, fields: ["name"] } as any;

    // Act
    const act = async () => await apiResolvers.Query.data(null, args);

    // Assert
    await expect(act).rejects.toThrowError("Invalid input.");
  });

  it("should filter fields correctly", async () => {

    // Arrange
    const data = [{ _id: 1, name: "John Doe", age: 30, address: { street: "123 Main St" } }];
    (db.collection as any).mockReturnValue({
      find: vi.fn((_, options) => {
        expect(options).toEqual({ projection: { name: 1, age: 1, "address.street": 1 } });
        return { toArray: vi.fn().mockResolvedValue(data) };
      }),
    });
    const args = {
      collectionName: "users",
      fields: ["name", "age", "address.street"],
    };

    // Act
    await apiResolvers.Query.data(null, args);

    // Assert
    // Assertions are done within the mock implementation
  });

  it("should ignore _id field when fetching schema", async () => {

    // Arrange
    const sampleDoc = { _id: 1, name: "test" };
    (db.collection as any).mockReturnValue({ findOne: vi.fn().mockResolvedValue(sampleDoc) });

    // Act
    const result = await apiResolvers.Query.schema(null, { collectionName: "users" });

    // Assert
    expect(result).toEqual([{ name: "name", type: "string" }]);
  });
});

