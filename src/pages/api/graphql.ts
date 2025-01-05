import { ApolloServer } from "@apollo/server";
import { startServerAndCreateNextHandler } from "@as-integrations/next";
import { Db, MongoClient } from "mongodb";

import * as z from "zod";

let client: MongoClient | null = null;
let db: Db | null = null;

const connectToDatabase = async () => {
  if (!client) {
    client = new MongoClient(process.env.MONGODB_URI || "");
  }
  if (!db) {
    await client.connect();
    db = client.db();
  }
  return db;
};


const FieldSchema = z.object({
  name: z.string(),
  type: z.string(),
});

const DataQuerySchema = z.object({
  collectionName: z.string(),
  fields: z.array(z.string()),
});


// GraphQL Schema
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

// Resolvers
const resolvers = {
  Query: {
    collections: async () => {
      const db = await connectToDatabase();
      const collections = await db.listCollections().toArray();
      return collections.map((col) => ({ name: col.name }));
    },

    schema: async (_, { collectionName }) => {
      const db = await connectToDatabase();
      const sampleDoc = await db.collection(collectionName).findOne();
      if (!sampleDoc) {
        return [];
      }

      const getFieldTypes = (obj: any, prefix = ""): z.infer<typeof FieldSchema>[] =>
        Object.entries(obj).flatMap(([key, value]) => {
          const fullName = prefix ? `${prefix}.${key}` : key;
          if (fullName.startsWith("_id")) {
            return [];
          }

          if (Array.isArray(value)) {
            return value.length > 0 && typeof value[0] === "object"
              ? [{ name: fullName, type: "Array<Object>" }, ...getFieldTypes(value[0], fullName)]
              : [{ name: fullName, type: "Array" }];
          } else if (typeof value === "object" && value !== null) {
            const children = getFieldTypes(value, fullName);
            return children.length > 0
              ? [{ name: fullName, type: "Object" }, ...children]
              : [{ name: fullName, type: "Object" }];
          }
          return [{ name: fullName, type: typeof value }];
        });

      return getFieldTypes(sampleDoc);
    },

    data: async (_, args) => {
      const parsedArgs = DataQuerySchema.safeParse(args);
      if (!parsedArgs.success) {
        console.error("Invalid input:", parsedArgs.error);
        throw new Error("Invalid input.");
      }
      const { collectionName, fields } = parsedArgs.data;

      const db = await connectToDatabase();
      const projection = fields.reduce((acc, field) => {
        const parts = field.split(".");
        let current = acc;
        for (let i = 0; i < parts.length; i++) {
          current[parts[i]] = i === parts.length - 1 ? 1 : current[parts[i]] || {};
          current = current[parts[i]];
        }
        return acc;
      }, {});

      return await db.collection(collectionName).find({}, { projection }).toArray();
    },
  },
};


const apolloServer = new ApolloServer({ typeDefs, resolvers });

export const schema = typeDefs;
export const apiResolvers = resolvers;

export default startServerAndCreateNextHandler(apolloServer);

