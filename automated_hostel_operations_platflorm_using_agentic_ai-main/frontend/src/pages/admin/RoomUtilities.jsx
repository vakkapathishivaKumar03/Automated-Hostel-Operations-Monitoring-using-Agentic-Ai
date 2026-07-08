import { useState } from 'react';
import ContextActionModal from '../../components/ContextActionModal';
import '../../styles/admin-room-utilities.css';

const RoomUtilities = () => {
  const [verifying, setVerifying] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);
  const [recalculateResult, setRecalculateResult] = useState(null);
  const [showRecalculateConfirm, setShowRecalculateConfirm] = useState(false);
  const [feedbackModal, setFeedbackModal] = useState({ open: false, title: '', message: '', tone: 'primary' });

  const isBusy = verifying || recalculating;

  const openFeedbackModal = (title, message, tone = 'primary') => {
    setFeedbackModal({ open: true, title, message, tone });
  };

  const handleVerifyOccupancy = async () => {
    setVerifying(true);
    try {
      const response = await fetch('http://localhost:5000/api/admin/rooms/verify-occupancy');
      const data = await response.json();
      setVerifyResult(data);
    } catch (error) {
      console.error('Error verifying occupancy:', error);
      openFeedbackModal('Verification Failed', 'Failed to verify occupancy', 'danger');
    } finally {
      setVerifying(false);
    }
  };

  const handleRecalculateOccupancyClick = () => {
    setShowRecalculateConfirm(true);
  };

  const handleRecalculateOccupancyConfirm = async () => {
    setShowRecalculateConfirm(false);
    setRecalculating(true);
    try {
      const response = await fetch('http://localhost:5000/api/admin/rooms/recalculate-occupancy', {
        method: 'POST'
      });
      const data = await response.json();
      if (data.success) {
        setRecalculateResult(data);
        openFeedbackModal('Recalculation Complete', data.message, 'success');
        // Re-verify after recalculation
        await handleVerifyOccupancy();
      } else {
        openFeedbackModal('Recalculation Failed', `Failed: ${data.message}`, 'danger');
      }
    } catch (error) {
      console.error('Error recalculating occupancy:', error);
      openFeedbackModal('Recalculation Failed', 'Failed to recalculate occupancy', 'danger');
    } finally {
      setRecalculating(false);
    }
  };

  return (
    <div className="room-utilities-container">
      <header className="utilities-header page-header-card">
        <div className="page-header-text">
          <h1>Room Utilities</h1>
          <p>Administrative tools for room management</p>
        </div>
      </header>

      <div className="utilities-grid">
        {/* Verify Occupancy Card */}
        <div className="utility-card">
          <div className="card-icon">🔍</div>
          <h2>Verify Occupancy</h2>
          <p>Check if room occupancy counts match actual student assignments</p>
          <button 
            className="btn-primary"
            onClick={handleVerifyOccupancy}
            disabled={isBusy}
          >
            {verifying ? 'Verifying...' : 'Verify Now'}
          </button>

          {verifyResult && (
            <div className={`result-box ${verifyResult.has_issues ? 'warning' : 'success'}`}>
              {verifyResult.has_issues ? (
                <>
                  <h3>⚠️ Issues Found</h3>
                  <p>{verifyResult.discrepancies.length} rooms have incorrect occupancy counts</p>
                  <div className="discrepancies-list">
                    {verifyResult.discrepancies.map((disc, idx) => (
                      <div key={idx} className="discrepancy-item">
                        <strong>Room {disc.room_number}</strong> in {disc.block_name}
                        <br />
                        Stored: {disc.stored_count} | Actual: {disc.actual_count} | Capacity: {disc.capacity}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <h3>✅ All Clear</h3>
                  <p>All room occupancy counts are correct</p>
                </>
              )}
            </div>
          )}
        </div>

        {/* Recalculate Occupancy Card */}
        <div className="utility-card">
          <div className="card-icon">🔄</div>
          <h2>Recalculate Occupancy</h2>
          <p>Fix all room occupancy counts by counting actual student assignments</p>
          <button 
            className="btn-warning"
            onClick={handleRecalculateOccupancyClick}
            disabled={isBusy}
          >
            {recalculating ? 'Processing...' : 'Recalculate All'}
          </button>

          {recalculateResult && (
            <div className="result-box success">
              <h3>✅ Done</h3>
              <p>{recalculateResult.message}</p>
            </div>
          )}
        </div>
      </div>

      <div className="info-section">
        <h3>💡 When to Use These Tools</h3>
        <ul>
          <li><strong>Verify Occupancy:</strong> Run regularly to check for data inconsistencies</li>
          <li><strong>Recalculate Occupancy:</strong> Use when you notice incorrect room capacities displayed</li>
          <li>These tools automatically run on server startup to ensure data integrity</li>
        </ul>
      </div>

      <ContextActionModal
        open={showRecalculateConfirm}
        title="Recalculate Occupancy"
        message="This will recalculate occupancy counts for all rooms. Continue?"
        confirmText="Recalculate"
        cancelText="Cancel"
        tone="warning"
        onConfirm={handleRecalculateOccupancyConfirm}
        onClose={() => setShowRecalculateConfirm(false)}
      />

      <ContextActionModal
        open={feedbackModal.open}
        title={feedbackModal.title}
        message={feedbackModal.message}
        confirmText="OK"
        tone={feedbackModal.tone}
        hideCancel
        onConfirm={() => setFeedbackModal({ open: false, title: '', message: '', tone: 'primary' })}
        onClose={() => setFeedbackModal({ open: false, title: '', message: '', tone: 'primary' })}
      />
    </div>
  );
};

export default RoomUtilities;

