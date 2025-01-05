"use client";

import { useEffect, useState } from "react";

type Field = {
  name: string;
  type: string;
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
    } catch {
      setError("Failed to fetch data");
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

  const renderTable = () => {
    if ( !data || data.length === 0) return <p>No data to display</p>;

    const flattenData = (doc: any, prefix = "") => {
      return Object.entries(doc).reduce((acc, [key, value]) => {
        const fieldName = prefix ? `${prefix}.${key}` : key;
    
        // Handle MongoDB date fields
        if (value && value.$date) {
          acc[fieldName] = new Date(value.$date).toISOString();
          return acc;
        }

        if (Array.isArray(value)) {
          acc[fieldName] = value.map((item, index) => {
            if (typeof item === "object") {
              return Object.entries(item)
                .map(([k, v]) => `${k}: ${v}`)
                .join(", ");
            }
            return item;
          }).join("; "); // Join array items into a string
          return acc;
        }

        if (typeof value === "object" && value !== null) {
          return { ...acc, ...flattenData(value, fieldName) };
        }        
    
        if (
          value &&
          typeof value === "object" &&
          !Array.isArray(value) &&
          Object.keys(value).length > 0
        ) {
          return { ...acc, ...flattenData(value, fieldName) };
        }
    
        acc[fieldName] = value;
        return acc;
      }, {});
    };
    

    const rows = data.map((doc) => flattenData(doc));
    const columns = Array.from(new Set(selectedFields));

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
                <td key={col} className="px-4 py-2">{row[col] || ""}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-4">Dynamic Schema Query</h1>

      <div className="mb-4">
        <label className="block mb-2 font-medium">Select Collection:</label>
        <select
          value={selectedCollection || ""}
          onChange={(e) => setSelectedCollection(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-md"
        >
          <option value="" disabled>
            Select a collection
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
          <h2 className="text-xl font-semibold mb-2">Select Fields</h2>
          {schema.length > 0 ? (
            schema.map((field) => (
              field.type === "Object" ? (
                <div key={field.name} className="mb-2">
                  <strong>{field.name}</strong>
                </div>
              ) : (
                <label key={field.name} className="block mb-1">
                  <input
                    type="checkbox"
                    value={field.name}
                    onChange={() => toggleField(field.name)}
                    className="mr-2"
                  />
                  {field.name} ({field.type})
                </label>
            )))
          ) : (
            <p>No fields available for the selected collection.</p>
          )}
        </div>
      )}

      <button
        onClick={fetchData}
        disabled={loading}
        className="bg-blue-500 text-white px-4 py-2 rounded-md disabled:opacity-50"
      >
        Fetch Data
      </button>

      {loading && <p className="mt-4 text-gray-500">Loading...</p>}
      {error && <p className="mt-4 text-red-500">{error}</p>}

      <div className="mt-6">
        <h2 className="text-2xl font-semibold">Results</h2>
        {renderTable()}
      </div>
    </div>
  );
}
