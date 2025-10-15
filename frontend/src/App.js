import React from 'react';
import DataTable from './components/DataTable';
import 'bootstrap/dist/css/bootstrap.min.css';

function App() {
  return (
    <div className="container mt-4">
      <h1 className="mb-4">Таблиця даних</h1>
      <DataTable />
    </div>
  );
}

export default App;
