import React from 'react';

export function AdminPageSimple({ onLogout, language }) {
  ;
  
  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-3xl font-bold mb-4">Admin Dashboard (Simple)</h1>
      <p className="mb-4">Language: {language}</p>
      <button 
        onClick={onLogout}
        className="bg-red-600 px-4 py-2 rounded hover:bg-red-700"
      >
        Logout
      </button>
    </div>
  );
}

export default AdminPageSimple;
