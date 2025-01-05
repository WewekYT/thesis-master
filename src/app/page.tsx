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
      <table>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={idx}>
              {columns.map((col) => (
                <td key={col}>{row[col] || ""}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <div>
      <h1>Dynamic Schema Query</h1>

      <div>
        <label>
          Select Collection:
          <select
            value={selectedCollection || ""}
            onChange={(e) => setSelectedCollection(e.target.value)}
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
        </label>
      </div>

      {selectedCollection && (
        <div>
          <h2>Select Fields</h2>
          {schema.length > 0 ? (
            schema.map((field) => (
              field.type === "Object" ? (
                <div key={field.name}>
                  <strong>{field.name}</strong>
                </div>
              ) : (
                <label key={field.name}>
                  <input
                    type="checkbox"
                    value={field.name}
                    onChange={() => toggleField(field.name)}
                  />
                  {field.name} ({field.type})
                </label>
            )))
          ) : (
            <p>No fields available for the selected collection.</p>
          )}
        </div>
      )}

      <button onClick={fetchData} disabled={loading}>
        Fetch Data
      </button>

      {loading && <p>Loading...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      <div>
        <h2>Results</h2>
        {renderTable()}
      </div>
    </div>
  );
}
