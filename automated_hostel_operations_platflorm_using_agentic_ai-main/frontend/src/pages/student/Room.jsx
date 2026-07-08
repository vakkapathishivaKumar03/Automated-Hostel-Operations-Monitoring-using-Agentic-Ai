import React, { useEffect, useState } from 'react';
import { getCurrentUser } from '../../utils/auth';
import '../../styles/student-room.css';

const DEFAULT_AMENITIES = ['WiFi', 'Study Table', 'Wardrobe', 'Ceiling Fan'];

const getOrdinalFloorLabel = (floorNumber) => {
  if (!Number.isFinite(floorNumber)) return '—';
  if (floorNumber === 0) return 'Ground Floor';

  const tens = floorNumber % 100;
  const ones = floorNumber % 10;
  let suffix = 'th';

  if (tens < 11 || tens > 13) {
    if (ones === 1) suffix = 'st';
    if (ones === 2) suffix = 'nd';
    if (ones === 3) suffix = 'rd';
  }

  return `${floorNumber}${suffix} Floor`;
};

const formatFloorValue = (floorValue, roomNumber) => {
  if (floorValue !== null && floorValue !== undefined && floorValue !== '') {
    if (typeof floorValue === 'string' && Number.isNaN(Number(floorValue))) {
      return floorValue;
    }

    const parsed = Number(floorValue);
    if (!Number.isNaN(parsed)) {
      return getOrdinalFloorLabel(parsed);
    }
  }

  const roomNumberText = String(roomNumber || '').trim();
  const leading = roomNumberText.match(/^\d/);
  if (leading) {
    return getOrdinalFloorLabel(Number(leading[0]));
  }

  return '—';
};

const getStatusLabel = (status) => {
  const text = String(status || '').replace(/_/g, ' ').trim();
  if (!text) return '—';
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const getBlockLabel = (blockName) => {
  const text = String(blockName || '').trim();
  if (!text || text === '—') return '—';
  return /^block\s/i.test(text) ? text : `Block ${text}`;
};

const Room = () => {
  const currentUser = getCurrentUser();
  const [showModal, setShowModal] = useState(false);
  const [roomData, setRoomData] = useState({
    roomNumber: '—',
    block: '—',
    floor: '—',
    roomType: '—',
    capacity: { current: 0, total: 0 },
    amenities: [],
    status: '—',
    rent: null
  });
  const [roommates, setRoommates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [blocks, setBlocks] = useState([]);
  const [feedbackModal, setFeedbackModal] = useState({
    open: false,
    title: '',
    message: '',
    success: true,
  });
  const [formData, setFormData] = useState({
    preferredRoom: '',
    preferredBlock: '',
    detailedReason: ''
  });

  const showFeedbackModal = (title, message, success = true) => {
    setFeedbackModal({ open: true, title, message, success });
  };

  const fetchRoomDetails = async () => {
    try {
      if (!currentUser?.userId) {
        setError('Unable to load room details. Please sign in again.');
        setLoading(false);
        return;
      }

      setLoading(true);
      
      // Fetch room details
      const response = await fetch(`http://localhost:5000/api/student/room/${currentUser.userId}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Failed to load room details');
      }

      const room = data.data?.room || {};
      const roommatesList = Array.isArray(data.data?.roommates) ? data.data.roommates : [];
      const amenitiesList = room.amenities
        ? room.amenities.split(',').map((item) => item.trim()).filter(Boolean)
        : [];
      const normalizedAmenities = amenitiesList.length > 0 ? amenitiesList : DEFAULT_AMENITIES;

      setRoomData({
        roomNumber: room.room_number || '—',
        block: room.block_name || '—',
        floor: formatFloorValue(room.floor, room.room_number),
        roomType: room.room_type || '—',
        capacity: {
          current: room.occupied_count ?? 0,
          total: room.capacity ?? 0
        },
        amenities: normalizedAmenities,
        status: getStatusLabel(room.status),
        rent: room.rent_per_month ?? null
      });
      setRoommates(roommatesList);
      setError('');
      
      // Fetch blocks from database
      try {
        const blocksResponse = await fetch('http://localhost:5000/api/blocks');
        const blocksData = await blocksResponse.json();
        if (blocksData.success && Array.isArray(blocksData.data)) {
          setBlocks(blocksData.data);
          // Set first block as default if available
          if (blocksData.data.length > 0) {
            setFormData(prev => ({ ...prev, preferredBlock: blocksData.data[0].name }));
          }
        }
      } catch (blockError) {
        console.error('Error fetching blocks:', blockError);
      }
    } catch (err) {
      console.error('Error loading room details:', err);
      setError(err.message || 'Failed to load room details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoomDetails();
  }, [currentUser?.userId]);

  const guidelines = [
    'Maintain cleanliness and hygiene',
    'No loud music after 10 PM',
    'Switch off electrical appliances',
    'Report maintenance issues immediately',
    'Visitors must be registered at security',
  ];

  const roomTypeLabel = roomData.roomType && roomData.roomType !== '—'
    ? `${roomData.roomType.charAt(0).toUpperCase() + roomData.roomType.slice(1)} room`
    : '—';
  const occupancyPercent = roomData.capacity.total > 0
    ? Math.min(100, Math.round((roomData.capacity.current / roomData.capacity.total) * 100))
    : 0;

  const handleSubmitRequest = async () => {
    if (!currentUser?.userId) {
      showFeedbackModal('Authentication Required', 'Please sign in again.', false);
      return;
    }

    if (!formData.preferredBlock || !formData.detailedReason.trim()) {
      showFeedbackModal('Missing Details', 'Please fill in the required fields.', false);
      return;
    }

    try {
      const response = await fetch('http://localhost:5000/api/student/room-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.userId,
          preferredRoom: formData.preferredRoom,
          preferredBlock: formData.preferredBlock,
          detailedReason: formData.detailedReason
        })
      });
      const data = await response.json();

      if (data.success) {
        showFeedbackModal('Request Submitted', 'Room change request submitted successfully.');
        setFormData({
          preferredRoom: '',
          preferredBlock: blocks.length > 0 ? blocks[0].name : '',
          detailedReason: ''
        });
        setShowModal(false);
      } else {
        showFeedbackModal('Submission Failed', data.message || 'Failed to submit request.', false);
      }
    } catch (error) {
      console.error('Error submitting room change request:', error);
      showFeedbackModal('Submission Error', 'Failed to submit request.', false);
    }
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <>
      <header className="room-header">
        <div>
          <h1 className="room-title">Room Details</h1>
          <p className="room-subtitle">Your accommodation information</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            className="request-room-change-btn" 
            onClick={() => fetchRoomDetails()}
            style={{ backgroundColor: '#6366f1' }}
          >
            🔄 Refresh
          </button>
          <button className="request-room-change-btn" onClick={() => setShowModal(true)}>
            + Request Room Change
          </button>
        </div>
      </header>

      {loading && (
        <div className="room-content">
          <section className="room-overview-card">
            <div className="room-number">Loading...</div>
          </section>
        </div>
      )}

      {!loading && error && (
        <div className="room-content">
          <section className="room-overview-card">
            <div className="room-number">—</div>
            <p style={{ marginTop: '12px', color: '#ef4444' }}>{error}</p>
          </section>
        </div>
      )}

      {!loading && !error && (
      <div className="room-content">
        <section className="room-overview-card">
          <div className="room-number-wrap">
            <div className="room-number-label">Room Number</div>
            <div className="room-number">{roomData.roomNumber}</div>
          </div>
          <div className="room-meta">
            <span className="zone-badge">{roomTypeLabel}</span>
          </div>
          <div className="room-quick-metrics">
            <div className="metric-pill">
              <span className="metric-pill-label">Occupancy</span>
              <span className="metric-pill-value">{occupancyPercent}%</span>
            </div>
            <div className="metric-pill">
              <span className="metric-pill-label">Status</span>
              <span className="metric-pill-value">{roomData.status}</span>
            </div>
            {roomData.rent !== null && (
              <div className="metric-pill">
                <span className="metric-pill-label">Rent</span>
                <span className="metric-pill-value">₹{roomData.rent}</span>
              </div>
            )}
          </div>
          <div className="room-info-grid">
            <div className="room-info-item">
              <span className="info-icon">🏢</span>
              <span className="info-label">Block</span>
              <span className="info-value">{getBlockLabel(roomData.block)}</span>
            </div>
            <div className="room-info-item">
              <span className="info-icon">📍</span>
              <span className="info-label">Floor</span>
              <span className="info-value">{roomData.floor}</span>
            </div>
            <div className="room-info-item">
              <span className="info-icon">👥</span>
              <span className="info-label">Capacity</span>
              <span className="info-value">
                {roomData.capacity.current}/{roomData.capacity.total}
              </span>
            </div>
            <div className="room-info-item">
              <span className="info-icon">✅</span>
              <span className="info-label">Status</span>
              <span className="info-value">{roomData.status}</span>
            </div>
          </div>
        </section>

        <section className="roommate-card">
          <h2 className="card-title">Roommate</h2>
          {roommates.length > 0 ? (
            roommates.map((roommate, index) => (
              <div className="roommate-content" key={roommate.user_id}>
                <div className="roommate-avatar-wrap">
                  <div className="roommate-avatar">
                    {roommate.name?.split(' ').map((n) => n[0]).join('') || 'S'}
                  </div>
                  <span className="roommate-chip">Mate {index + 1}</span>
                </div>
                <div className="roommate-info">
                  <div className="roommate-name">{roommate.name}</div>
                  <div className="roommate-branch">{roommate.branch || '—'}</div>
                  <div className="roommate-year">{roommate.year || '—'}</div>
                </div>
              </div>
            ))
          ) : (
            <div className="roommate-content">
              <div className="roommate-info">
                <div className="roommate-name">No roommate assigned</div>
              </div>
            </div>
          )}
        </section>

        <section className="amenities-card">
          <h2 className="card-title">Amenities</h2>
          <div className="amenities-grid">
            {roomData.amenities.length > 0 ? (
              roomData.amenities.map((amenity) => (
                <div key={amenity} className="amenity-chip">
                  <span className="amenity-icon">✅</span>
                  <span className="amenity-name">{amenity}</span>
                </div>
              ))
            ) : (
              <div className="amenity-chip">
                <span className="amenity-name">No amenities listed</span>
              </div>
            )}
          </div>
        </section>

        <section className="guidelines-card">
          <h2 className="card-title">Room Guidelines</h2>
          <ul className="guidelines-list">
            {guidelines.map((guideline, index) => (
              <li key={index}>{guideline}</li>
            ))}
          </ul>
        </section>
      </div>
      )}

      {showModal && (
        <div className="request-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="request-modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="request-modal-header">
              <h2>Request Room Change</h2>
              <button
                className="request-modal-close"
                onClick={() => setShowModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="request-modal-body">
              {/* Current Room Information */}
              <div className="form-section">
                <h3>Current Room Information</h3>
                <div className="form-group-row">
                  <div className="form-group">
                    <label className="request-label">Current Room</label>
                    <input
                      type="text"
                      className="request-input"
                      value={roomData.roomNumber}
                      disabled
                      readOnly
                    />
                  </div>
                  <div className="form-group">
                    <label className="request-label">Current Block</label>
                    <input
                      type="text"
                      className="request-input"
                      value={getBlockLabel(roomData.block)}
                      disabled
                      readOnly
                    />
                  </div>
                </div>
              </div>

              {/* Requested Room Preferences */}
              <div className="form-section">
                <h3>Requested Room Preferences</h3>
                <div className="form-group-row">
                  <div className="form-group">
                    <label className="request-label">Preferred Room Number</label>
                    <input
                      type="text"
                      name="preferredRoom"
                      className="request-input"
                      placeholder="e.g., 104, 203, etc."
                      value={formData.preferredRoom}
                      onChange={handleFormChange}
                    />
                  </div>
                  <div className="form-group">
                    <label className="request-label">Preferred Block</label>
                    <select
                      name="preferredBlock"
                      className="request-input"
                      value={formData.preferredBlock}
                      onChange={handleFormChange}
                    >
                      <option value="">Select a block</option>
                      {blocks.map((block) => (
                        <option key={block.id} value={block.name}>
                          {block.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Detailed Reason */}
              <div className="form-section">
                <h3>Reason for Room Change</h3>
                <label className="request-label">Detailed Reason</label>
                <textarea
                  name="detailedReason"
                  className="request-textarea"
                  placeholder="Please describe in detail why you need a room change. Include any specific issues or preferences..."
                  value={formData.detailedReason}
                  onChange={handleFormChange}
                  rows={6}
                />
              </div>
            </div>

            <div className="request-modal-footer">
              <button
                className="request-btn-cancel"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </button>
              <button
                className="request-btn-submit"
                onClick={handleSubmitRequest}
              >
                Submit Request
              </button>
            </div>
          </div>
        </div>
      )}

      {feedbackModal.open && (
        <div className="request-modal-overlay" onClick={() => setFeedbackModal({ open: false, title: '', message: '', success: true })}>
          <div className="request-modal-container" style={{ maxWidth: '460px' }} onClick={(e) => e.stopPropagation()}>
            <div className="request-modal-header">
              <h2>{feedbackModal.title}</h2>
              <button
                className="request-modal-close"
                onClick={() => setFeedbackModal({ open: false, title: '', message: '', success: true })}
              >
                ✕
              </button>
            </div>
            <div className="request-modal-body" style={{ maxHeight: 'unset' }}>
              <p style={{ margin: 0, whiteSpace: 'pre-line', color: feedbackModal.success ? '#166534' : '#991b1b' }}>
                {feedbackModal.message}
              </p>
            </div>
            <div className="request-modal-footer">
              <button
                className="request-btn-submit"
                onClick={() => setFeedbackModal({ open: false, title: '', message: '', success: true })}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Room;

