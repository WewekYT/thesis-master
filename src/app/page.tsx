"use client";

import { useEffect, useState } from "react";

type Field = {
  name: string;
  type: string;
};

// Helper function to flatten nested objects and handle various data types
const flattenData = (doc: any, prefix = ""): Record<string, any> => {
  return Object.entries(doc).reduce((acc, [key, value]) => {
    const fieldName = prefix ? `${prefix}.${key}` : key;

  if (Array.isArray(value)) {
      acc[fieldName] = value.map((item) =>
        typeof item === "object"
          ? Object.entries(item).map(([k, v]) => `${k}: ${v}`).join(", ")
          : item
      ).join("; ");
    } else if (typeof value === "object" && value !== null) {
      Object.assign(acc, flattenData(value, fieldName));
    } else {
      acc[fieldName] = value;
    }

    return acc;
  }, {} as Record<string, any>);
};


// Component to render the data table
const DataTable = ({ data, columns }: { data: any[], columns: string[] }) => {
  if (!data || data.length === 0) return <p>W tej chwili brak danych do wyświetlenia. Spróbuj ponownie.</p>;

  const rows = data.map((doc) => flattenData(doc));

  return (
    <table className="min-w-full table-auto mt-4 border border-gray-200">
      <thead>
        <tr>
          {columns.map((col) => (
            <th key={col} className="px-4 py-2 text-left bg-gray-100">{col}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, idx) => (
          <tr key={idx} className="hover:bg-gray-50">
            {columns.map((col) => (
              <td key={col} className="px-4 py-2">{row[col] ?? ""}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};


export default function Home() {
  const [collections, setCollections] = useState<string[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [schema, setSchema] = useState<Field[]>([]);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCollections = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/graphql", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: `
              query {
                collections {
                  name
                }
              }
            `,
          }),
        });
        const { data } = await res.json();
        setCollections(data.collections.map((col: { name: string }) => col.name));
      } catch {
        setError("Failed to fetch collections");
      } finally {
        setLoading(false);
      }
    };
    fetchCollections();
  }, []);

  useEffect(() => {
    if (selectedCollection) {
      const fetchSchema = async () => {
        setLoading(true);
        try {
          const res = await fetch("/api/graphql", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              query: `
                query($collectionName: String!) {
                  schema(collectionName: $collectionName) {
                    name
                    type
                  }
                }
              `,
              variables: { collectionName: selectedCollection },
            }),
          });
          const { data } = await res.json();
          setSchema(data.schema);
        } catch {
          setError("Failed to fetch schema");
        } finally {
          setLoading(false);
        }
      };
      fetchSchema();
    }
  }, [selectedCollection]);

  const fetchData = async () => {
    if (!selectedCollection || selectedFields.length === 0) {
      setError("Please select a collection and at least one field");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `
            query($collectionName: String!, $fields: [String!]!) {
              data(collectionName: $collectionName, fields: $fields)
            }
          `,
          variables: {
            collectionName: selectedCollection,
            fields: selectedFields,
          },
        }),
      });
      const { data } = await res.json();
      setData(data.data);
    } catch (error: any) {
      setError(`Failed to fetch data: ${error.message}`); 
    } finally {
      setLoading(false);
    }
  };

  const toggleField = (fieldName: string) => {
    setSelectedFields((prev) =>
      prev.includes(fieldName)
        ? prev.filter((f) => f !== fieldName)
        : [...prev, fieldName]
    );
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-4">Podgląd danych</h1>

      <div className="mb-4">
        <label className="block mb-2 font-medium">Wybór kolekcji:</label>
        <select
          value={selectedCollection || ""}
          onChange={(e) => setSelectedCollection(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-md"
        >
          <option value="" disabled>
            Wybierz...
          </option>
          {collections.map((col) => (
            <option key={col} value={col}>
              {col}
            </option>
          ))}
        </select>
      </div>

      {selectedCollection && (
        <div className="mb-4">
          <h2 className="text-xl font-semibold mb-2">Wybór pól</h2>
          {schema.length > 0 ? (
            schema.map((field) => (
              <label key={field.name} className="block mb-1">
                  <input
                    type="checkbox"
                    value={field.name}
                    onChange={() => toggleField(field.name)}
                    className="mr-2"
                  />
                  {field.name} ({field.type})
                </label>
            ))
          ) : (
            <p>Ta kolekcja nie przechowuje żadnych pól.</p>
          )}
        </div>
      )}

      <button
        onClick={fetchData}
        disabled={loading}
        className="bg-blue-500 text-white px-4 py-2 rounded-md disabled:opacity-50"
      >
        Pobierz dane
      </button>

      {loading && <p className="mt-4 text-gray-500">Wczytywanie...</p>}
      {error && <p className="mt-4 text-red-500">{error}</p>}

      <div className="mt-6">
      <h2 className="text-2xl font-semibold">Wyniki dla wybranych pól:</h2>
      <DataTable data={data} columns={selectedFields} /> {/* Pass data and columns */}
    </div>
    </div>
  );
}
