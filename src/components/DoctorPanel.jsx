import { useEffect, useState } from "react";
import { api } from "../lib/api-unified";

export default function DoctorPanel({ clinicId }) {
  const [current, setCurrent] = useState(null);

  const callNext = async () => {
    const next = await api.callNextPatient(clinicId);
    setCurrent(next);
  };

  useEffect(() => {
    callNext();
  }, [clinicId]);

  return (
    <div>
      <h2>Doctor Panel</h2>
      <p>Current: {current?.display_number || "--"}</p>
      <button onClick={callNext}>Call Next</button>
    </div>
  );
}
