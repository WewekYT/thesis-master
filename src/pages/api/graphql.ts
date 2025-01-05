import { ApolloServer } from "@apollo/server";
import { startServerAndCreateNextHandler } from "@as-integrations/next";
import { Db, MongoClient } from "mongodb";

// MongoDB client initialization
let client;
let db: Db;

async function connectToDatabase() {
  if (db) {
    return db;
  }

  try {
    client = new MongoClient(process.env.MONGODB_URI || "");
    await client.connect();
    db = client.db(); // Access the default database
    return db;
  } catch (error) {
    console.error("Error connecting to database:", error);
    throw new Error("Failed to connect to database.");
  }
}

// Define GraphQL Schema
const typeDefs = `
  type Field {
    name: String
    type: String
  }

  type Collection {
    name: String
  }

  type Query {
    collections: [Collection]
    schema(collectionName: String!): [Field]
    data(collectionName: String!, fields: [String!]!): [JSON]
  }

  scalar JSON
`;

// Define resolvers for queries
const resolvers = {
  Query: {
    // Get list of all collections
    collections: async () => {
      try {
        const db = await connectToDatabase();
        const collections = await db.listCollections().toArray();
        return collections.map((col) => ({ name: col.name }));
      } catch (error) {
        console.error("Error fetching collections:", error);
        throw new Error("Failed to fetch collections.");
      }
    },

    // Get schema of the selected collection
    schema: async (_, { collectionName }) => {
      try {
        const db = await connectToDatabase();
        const sampleDoc = await db.collection(collectionName).findOne({});
        
        if (!sampleDoc) {
          return [];
        }

        const docJSON = sampleDoc.toJSON ? sampleDoc.toJSON() : sampleDoc;
        if (!docJSON || typeof docJSON !== "object") {
          throw new Error("Invalid document structure");
        }

        const getFieldTypes = (obj, prefix = "") => {
          return Object.entries(obj).flatMap(([key, value]) => {
            const fullName = prefix ? `${prefix}.${key}` : key;
        
            // Exclude _id and related fields
            if (fullName.includes("_id")) return [];
        
            // Handle arrays and objects
            if (Array.isArray(value)) {
              if (value.length > 0 && typeof value[0] === "object") {
                // Expand array of objects
                return [
                  { name: fullName, type: "Array<Object>" },
                  ...getFieldTypes(value[0], fullName),
                ];
              }
              return { name: fullName, type: "Array" };
            } else if (typeof value === "object" && value !== null) {
              const children = getFieldTypes(value, fullName);
              if (children.length > 0) {
                return [{ name: fullName, type: "Object" }, ...children];
              }
              return { name: fullName, type: "Object" };
            }
        
            // Include primitive fields
            return { name: fullName, type: typeof value };
          });
        };
        

        return getFieldTypes(docJSON);
      } catch (error) {
        console.error(`Error fetching schema for ${collectionName}:`, error);
        throw new Error("Failed to fetch schema.");
      }
    },

    // Fetch data based on selected fields from a collection
    data: async (_, { collectionName, fields }) => {
      try {
        const db = await connectToDatabase();
    
        // Build projection object for nested fields
        const projection = fields.reduce((acc, field) => {
          field.split(".").reduce((obj, key, idx, src) => {
            obj[key] = idx === src.length - 1 ? 1 : obj[key] || {};
            return obj[key];
          }, acc);
          return acc;
        }, {});
    
        const documents = await db.collection(collectionName).find({}, { projection }).toArray();
    
        return documents.map((doc) => doc);
      } catch (error) {
        console.error(`Error fetching data from ${collectionName}:`, error);
        throw new Error("Failed to fetch data.");
      }
    },
    
  },
};

// Initialize Apollo Server
const apolloServer = new ApolloServer({
  typeDefs,
  resolvers,
});

export typeDefs;
export resolvers;

// Export Apollo Server handler for Next.js
export default startServerAndCreateNextHandler(apolloServer);
