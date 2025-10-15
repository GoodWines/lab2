import React, { useEffect, useState } from "react";
import axios from "axios";

const API_URL = "http://localhost:5000/api/measurements";

const DataTable = () => {
  const [measurements, setMeasurements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);

  const [formData, setFormData] = useState({
    station_id: "",
    measurement_time: "",
    pollutant: "",
    value: "",
    unit: "",
  });

  // ========================
  // READ
  // ========================
  const fetchData = async () => {
    try {
      const response = await axios.get(`${API_URL}/latest`);
      const data = response.data?.data || response.data;
      if (Array.isArray(data)) {
        setMeasurements(data);
      } else {
        setError("Invalid response format");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // ========================
  // HANDLE INPUTS
  // ========================
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // ========================
  // CREATE or UPDATE
  // ========================
  const handleSubmit = async (e) => {
    e.preventDefault();

    const payload = {
      station_id: formData.station_id || "",
      measurement_time: formData.measurement_time || new Date().toISOString(),
      pollutants: [
        {
          pollutant: formData.pollutant || "",
          value: formData.value === "" ? null : formData.value,
          unit: formData.unit || "",
        },
      ],
    };

    try {
      if (editingId) {
        await axios.put(`${API_URL}/${editingId}`, payload);
      } else {
        await axios.post(API_URL, payload);
      }

      await fetchData();
      resetForm();
    } catch (err) {
      alert("Error: " + (err.response?.data?.error || err.message));
    }
  };

  // ========================
  // DELETE
  // ========================
  const handleDelete = async (id) => {
    if (!window.confirm("Видалити цей запис?")) return;
    try {
      await axios.delete(`${API_URL}/${id}`);
      setMeasurements((prev) => prev.filter((m) => m._id !== id));
    } catch (err) {
      alert("Помилка видалення: " + (err.response?.data?.error || err.message));
    }
  };

  // ========================
  // EDIT
  // ========================
  const handleEdit = (m) => {
    const p = m.pollutants?.[0] || {};
    const date = new Date(m.measurement_time);
    const formattedDate = date.toISOString().slice(0, 16);

    setFormData({
      station_id: m.station_id || "",
      measurement_time: formattedDate || "",
      pollutant: p.pollutant || "",
      value: p.value || "",
      unit: p.unit || "",
    });
    setEditingId(m._id);
  };

  // ========================
  // RESET FORM
  // ========================
  const resetForm = () => {
    setFormData({
      station_id: "",
      measurement_time: "",
      pollutant: "",
      value: "",
      unit: "",
    });
    setEditingId(null);
  };

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error}</p>;

  // ========================
  // RENDER
  // ========================
  return (
    <div className="datatable-container">
      <h2>Measurements CRUD 😎</h2>

      <form className="crud-form" onSubmit={handleSubmit}>
        <input
          type="text"
          name="station_id"
          placeholder="Station ID"
          value={formData.station_id}
          onChange={handleChange}
        />
        <input
          type="datetime-local"
          name="measurement_time"
          value={formData.measurement_time}
          onChange={handleChange}
        />
        <input
          type="text"
          name="pollutant"
          placeholder="Pollutant (e.g. PM2.5)"
          value={formData.pollutant}
          onChange={handleChange}
        />
        <input
          type="number"
          name="value"
          placeholder="Value"
          value={formData.value}
          onChange={handleChange}
        />
        <input
          type="text"
          name="unit"
          placeholder="Unit (e.g. µg/m³)"
          value={formData.unit}
          onChange={handleChange}
        />
        <button type="submit">{editingId ? "Update" : "Add"} Measurement</button>
        {editingId && (
          <button type="button" onClick={resetForm}>
            Cancel
          </button>
        )}
      </form>

      <table className="datatable">
        <thead>
          <tr>
            <th>Station ID</th>
            <th>Time</th>
            <th>Pollutants</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {measurements.map((m) => (
            <tr key={m._id}>
              <td>{m.station_id}</td>
              <td>{new Date(m.measurement_time).toLocaleString()}</td>
              <td>
                {m.pollutants?.map((p, idx) => (
                  <div key={idx}>
                    {p.pollutant}: {p.value} {p.unit}
                  </div>
                ))}
              </td>
              <td>
                <button onClick={() => handleEdit(m)}>Edit</button>
                <button onClick={() => handleDelete(m._id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default DataTable;
