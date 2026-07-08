import { useState, useEffect } from 'react';
import OccupancyAnalytics from '../../components/OccupancyAnalytics';
import { getCurrentUser } from '../../utils/auth';
import '../../styles/warden-rooms.css';

const Rooms = () => {
  const currentUser = getCurrentUser();

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    'X-User-Id': String(currentUser?.userId || ''),
    'X-User-Role': String(currentUser?.role || 'warden')
  });

  const authOnlyHeaders = () => ({
    'X-User-Id': String(currentUser?.userId || ''),
    'X-User-Role': String(currentUser?.role || 'warden')
  });

  // State for rooms from database
  const [allRooms, setAllRooms] = useState([]);
  const [hostelBlocks, setHostelBlocks] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch rooms and blocks from database
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch hostel blocks
        const blocksRes = await fetch('http://localhost:5000/api/warden/hostel-blocks', {
          headers: authOnlyHeaders()
        });
        const blocksData = await blocksRes.json();
        
        // Fetch all rooms
        const roomsRes = await fetch('http://localhost:5000/api/rooms/all');
        const roomsData = await roomsRes.json();
        
        if (blocksData.success && Array.isArray(blocksData.data)) {
          setHostelBlocks(blocksData.data);
        }
        
        if (roomsData.success && Array.isArray(roomsData.data)) {
          // Transform rooms data to match UI expectations
          const transformedRooms = roomsData.data.map(room => ({
            id: room.id,
            roomNumber: room.room_number,
            block: room.block_name,
            floor: room.floor ? `Floor ${room.floor}` : `Floor ${Math.floor(parseInt(room.room_number) / 100)}`,
            capacity: room.capacity,
            currentOccupancy: room.occupied_count || 0,
            roomType: room.room_type || (room.capacity === 1 ? 'Single' : room.capacity === 2 ? 'Double' : 'Triple'),
            status: room.status,
            students: [], // Populated by separate API call when viewing details
            roomChangeRequests: []
          }));
          setAllRooms(transformedRooms);
        }
      } catch (error) {
        console.error('Error fetching rooms:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Dummy room data for fallback (will be removed once DB is populated)
  const [allRoomsDummy] = useState([
    {
      id: 1,
      roomNumber: '101',
      block: 'Block A',
      floor: '1st Floor',
      capacity: 3,
      currentOccupancy: 3,
      roomType: 'Triple',
      students: [
        { id: 1, name: 'Rahul Mehta', roll: 'CS21B001', branch: 'CSE' },
        { id: 2, name: 'Priya Sharma', roll: 'CS21B002', branch: 'CSE' },
        { id: 3, name: 'Arjun Singh', roll: 'CS21B003', branch: 'CSE' }
      ],
      roomChangeRequests: [
        { id: 1, studentName: 'Rahul Mehta', reason: 'Requested room change due to noise issues', date: '2026-02-01', status: 'Pending' }
      ]
    },
    {
      id: 2,
      roomNumber: '102',
      block: 'Block A',
      floor: '1st Floor',
      capacity: 2,
      currentOccupancy: 2,
      roomType: 'Double',
      students: [
        { id: 4, name: 'Ananya Reddy', roll: 'EC21B041', branch: 'ECE' },
        { id: 5, name: 'Sneha Patel', roll: 'EC21B042', branch: 'ECE' }
      ],
      roomChangeRequests: []
    },
    {
      id: 3,
      roomNumber: '103',
      block: 'Block A',
      floor: '1st Floor',
      capacity: 3,
      currentOccupancy: 1,
      roomType: 'Triple',
      students: [
        { id: 6, name: 'Vikram Kumar', roll: 'ME21B061', branch: 'ME' }
      ],
      roomChangeRequests: []
    },
    {
      id: 4,
      roomNumber: '104',
      block: 'Block A',
      floor: '1st Floor',
      capacity: 1,
      currentOccupancy: 0,
      roomType: 'Single',
      students: [],
      roomChangeRequests: []
    },
    {
      id: 5,
      roomNumber: '201',
      block: 'Block A',
      floor: '2nd Floor',
      capacity: 2,
      currentOccupancy: 2,
      roomType: 'Double',
      students: [
        { id: 7, name: 'Aisha Khan', roll: 'CE21B081', branch: 'CIVIL' },
        { id: 8, name: 'Ravi Patel', roll: 'CE21B082', branch: 'CIVIL' }
      ],
      roomChangeRequests: [
        { id: 2, studentName: 'Aisha Khan', reason: 'Requested room change for accommodation', date: '2026-02-03', status: 'Approved' }
      ]
    },
    {
      id: 6,
      roomNumber: '202',
      block: 'Block A',
      floor: '2nd Floor',
      capacity: 3,
      currentOccupancy: 2,
      roomType: 'Triple',
      students: [
        { id: 9, name: 'Divya Singh', roll: 'EE21B101', branch: 'EEE' },
        { id: 10, name: 'Kamal Nair', roll: 'EE21B102', branch: 'EEE' }
      ],
      roomChangeRequests: []
    },
    {
      id: 7,
      roomNumber: '301',
      block: 'Block B',
      floor: '3rd Floor',
      capacity: 2,
      currentOccupancy: 1,
      roomType: 'Double',
      students: [
        { id: 11, name: 'Sanjay Gupta', roll: 'IT21B121', branch: 'IT' }
      ],
      roomChangeRequests: [
        { id: 3, studentName: 'Sanjay Gupta', reason: 'Requested room change for better amenities', date: '2026-02-02', status: 'Pending' }
      ]
    },
    {
      id: 8,
      roomNumber: '302',
      block: 'Block B',
      floor: '3rd Floor',
      capacity: 3,
      currentOccupancy: 0,
      roomType: 'Triple',
      students: [],
      roomChangeRequests: []
    },
    {
      id: 9,
      roomNumber: '101',
      block: 'Block C',
      floor: '1st Floor',
      capacity: 2,
      currentOccupancy: 2,
      roomType: 'Double',
      students: [
        { id: 12, name: 'Neha Verma', roll: 'BT21B141', branch: 'BIO' },
        { id: 13, name: 'Amit Kumar', roll: 'BT21B142', branch: 'BIO' }
      ],
      roomChangeRequests: []
    },
    {
      id: 10,
      roomNumber: '102',
      block: 'Block C',
      floor: '1st Floor',
      capacity: 1,
      currentOccupancy: 0,
      roomType: 'Single',
      students: [],
      roomChangeRequests: []
    }
  ]);

  // Filter states
  const [blockFilter, setBlockFilter] = useState('All');
  const [floorFilter, setFloorFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [occupancyFilter, setOccupancyFilter] = useState('All');
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [isEditingCapacity, setIsEditingCapacity] = useState(false);
  const [newCapacity, setNewCapacity] = useState('');
  const [savingCapacity, setSavingCapacity] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingRoom, setDeletingRoom] = useState(false);
  // In-modal message state
  const [modalMessage, setModalMessage] = useState(null);
  const [modalMessageType, setModalMessageType] = useState('success');

  // Get unique blocks, floors, and types
  const blocks = ['All', ...new Set(allRooms.map(room => room.block))];
  const floors = ['All', ...new Set(allRooms.map(room => room.floor))];
  const roomTypes = ['All', ...new Set(allRooms.map(room => room.roomType))];

  // Filter rooms
  const getFilteredRooms = () => {
    return allRooms.filter(room => {
      const blockMatch = blockFilter === 'All' || room.block === blockFilter;
      const floorMatch = floorFilter === 'All' || room.floor === floorFilter;
      const typeMatch = typeFilter === 'All' || room.roomType === typeFilter;
      
      let occupancyMatch = true;
      if (occupancyFilter === 'Occupied') {
        occupancyMatch = room.currentOccupancy === room.capacity;
      } else if (occupancyFilter === 'Partial') {
        occupancyMatch = room.currentOccupancy > 0 && room.currentOccupancy < room.capacity;
      } else if (occupancyFilter === 'Vacant') {
        occupancyMatch = room.currentOccupancy === 0;
      }

      return blockMatch && floorMatch && typeMatch && occupancyMatch;
    });
  };

  const filteredRooms = getFilteredRooms();

  // Get room status
  const getRoomStatus = (room) => {
    if (room.currentOccupancy === 0) return 'Vacant';
    if (room.currentOccupancy === room.capacity) return 'Fully Occupied';
    return 'Partial';
  };

  const getStatusBadgeClass = (room) => {
    if (room.currentOccupancy === 0) return 'status-vacant';
    if (room.currentOccupancy === room.capacity) return 'status-full';
    return 'status-partial';
  };

  // Helper function to show message in modal with auto-dismiss
  const showMessage = (message, type = 'success') => {
    setModalMessage(message);
    setModalMessageType(type);
    setTimeout(() => setModalMessage(null), 3000);
  };

  // Handle capacity edit
  const handleEditCapacity = () => {
    setNewCapacity(selectedRoom.capacity.toString());
    setIsEditingCapacity(true);
  };

  const handleCancelEdit = () => {
    setIsEditingCapacity(false);
    setNewCapacity('');
  };

  const handleCloseModal = () => {
    setSelectedRoom(null);
    setIsEditingCapacity(false);
    setNewCapacity('');
  };

  const handleSaveCapacity = async () => {
    const capacityNum = parseInt(newCapacity);
    
    if (isNaN(capacityNum) || capacityNum < 1) {
      showMessage('Please enter a valid capacity (minimum 1)', 'error');
      return;
    }

    if (capacityNum < selectedRoom.currentOccupancy) {
      showMessage(`Cannot set capacity lower than current occupancy (${selectedRoom.currentOccupancy})`, 'error');
      return;
    }

    setSavingCapacity(true);
    try {
      const response = await fetch(`http://localhost:5000/api/warden/rooms/${selectedRoom.id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          room_number: selectedRoom.roomNumber,
          capacity: capacityNum
        })
      });

      const data = await response.json();

      if (data.success) {
        // Update local state
        setSelectedRoom(prev => ({ ...prev, capacity: capacityNum }));
        setAllRooms(prev => prev.map(room => 
          room.id === selectedRoom.id ? { ...room, capacity: capacityNum } : room
        ));
        setIsEditingCapacity(false);
        setNewCapacity('');
        showMessage('Room capacity updated successfully', 'success');
      } else {
        showMessage(data.message || 'Failed to update capacity', 'error');
      }
    } catch (error) {
      console.error('Error updating capacity:', error);
      showMessage('Failed to update capacity', 'error');
    } finally {
      setSavingCapacity(false);
    }
  };

  // Delete handler with backend logic
  const handleDeleteRoom = async () => {
    setDeletingRoom(true);
    try {
      const response = await fetch(`http://localhost:5000/api/warden/rooms/${selectedRoom.id}`, {
        method: 'DELETE',
        headers: authOnlyHeaders()
      });
      const data = await response.json();
      if (data.success) {
        setAllRooms(prev => prev.filter(r => r.id !== selectedRoom.id));
        setShowDeleteModal(false);
        setSelectedRoom(null);
        showMessage('Room deleted successfully', 'success');
      } else {
        setShowDeleteModal(false);
        showMessage(data.message || 'Failed to delete room', 'error');
      }
    } catch (error) {
      console.error('Error deleting room:', error);
      setShowDeleteModal(false);
      showMessage('Error deleting room', 'error');
    } finally {
      setDeletingRoom(false);
    }
  };

  useEffect(() => {
    if (!selectedRoom?.id) return;

    const fetchRoomStudents = async () => {
      setStudentsLoading(true);
      try {
        const response = await fetch(`http://localhost:5000/api/warden/rooms/${selectedRoom.id}/students`, {
          headers: authOnlyHeaders()
        });
        const data = await response.json();

        if (data.success && Array.isArray(data.data)) {
          const mappedStudents = data.data.map((student) => ({
            id: student.student_id || student.id,
            name: student.name,
            roll: student.roll_number || 'N/A',
            branch: student.branch || 'N/A'
          }));

          setSelectedRoom((prev) => (prev && prev.id === selectedRoom.id ? {
            ...prev,
            students: mappedStudents
          } : prev));
        }
      } catch (error) {
        console.error('Error fetching room students:', error);
      } finally {
        setStudentsLoading(false);
      }
    };

    fetchRoomStudents();
  }, [selectedRoom?.id]);

  useEffect(() => {
    if (!selectedRoom?.id) return;

    const fetchRoomChangeRequests = async () => {
      setRequestsLoading(true);
      try {
        const response = await fetch(`http://localhost:5000/api/warden/rooms/${selectedRoom.id}/change-requests`, {
          headers: authOnlyHeaders()
        });
        const data = await response.json();

        if (data.success && Array.isArray(data.data)) {
          const mappedRequests = data.data.map((request) => ({
            id: request.id,
            studentName: request.student_name || 'N/A',
            reason: request.preference_reason || request.full_reason || 'N/A',
            date: request.created_at ? new Date(request.created_at).toLocaleDateString('en-GB') : 'N/A',
            status: request.status || 'pending'
          }));

          setSelectedRoom((prev) => (prev && prev.id === selectedRoom.id ? {
            ...prev,
            roomChangeRequests: mappedRequests
          } : prev));
        }
      } catch (error) {
        console.error('Error fetching room change requests:', error);
      } finally {
        setRequestsLoading(false);
      }
    };

    fetchRoomChangeRequests();
  }, [selectedRoom?.id]);

  return (
    <div className="rooms-page">
      {/* Page Header */}
      <div className="page-header-card">
        <div className="page-header-text">
          <h2>Rooms</h2>
          <p>View hostel room occupancy and availability from database</p>
        </div>
      </div>

      {loading ? (
        <div style={{textAlign: 'center', padding: '4rem', color: '#64748b'}}>
          <div style={{fontSize: '2rem', marginBottom: '1rem'}}>⏳</div>
          <p>Loading rooms from database...</p>
        </div>
      ) : (
        <>
          {/* Occupancy Analytics */}
          <OccupancyAnalytics roomsData={allRooms} />

      {/* Filters Section */}
      <div className="rooms-filters">
        <div className="filter-group">
          <label>Block</label>
          <select 
            value={blockFilter} 
            onChange={(e) => setBlockFilter(e.target.value)}
            className="filter-select"
          >
            {blocks.map(block => (
              <option key={block} value={block}>{block}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Floor</label>
          <select
            value={floorFilter}
            onChange={(e) => setFloorFilter(e.target.value)}
            className="filter-select"
          >
            {floors.map(floor => (
              <option key={floor} value={floor}>{floor}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Room Type</label>
          <select 
            value={typeFilter} 
            onChange={(e) => setTypeFilter(e.target.value)}
            className="filter-select"
          >
            {roomTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Occupancy</label>
          <select 
            value={occupancyFilter} 
            onChange={(e) => setOccupancyFilter(e.target.value)}
            className="filter-select"
          >
            <option value="All">All</option>
            <option value="Occupied">Occupied</option>
            <option value="Partial">Partial</option>
            <option value="Vacant">Vacant</option>
          </select>
        </div>
      </div>

      {/* Rooms Grid */}
      {filteredRooms.length > 0 ? (
        <div className="rooms-grid">
          {filteredRooms.map(room => (
            <div 
              key={room.id} 
              className={`room-card ${getStatusBadgeClass(room)}`}
              onClick={() => setSelectedRoom(room)}
            >
              <div className="room-card-header">
                <div>
                  <h3 className="room-number">Room {room.roomNumber}</h3>
                  <p className="room-location">{room.block} - {room.floor}</p>
                </div>
                <span className={`status-badge ${getStatusBadgeClass(room)}`}>
                  {getRoomStatus(room)}
                </span>
              </div>

              <div className="room-card-body">
                <div className="room-info">
                  <div className="info-item">
                    <span className="info-label">Type</span>
                    <span className="info-value">{room.roomType}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Occupancy</span>
                    <span className="info-value">{room.currentOccupancy} / {room.capacity}</span>
                  </div>
                </div>

                <div className="occupancy-bar">
                  <div 
                    className="occupancy-fill" 
                    style={{ width: `${(room.currentOccupancy / room.capacity) * 100}%` }}
                  />
                </div>
              </div>

              <div className="room-card-footer">
                <button className="btn-view-details">View Details</button>
                <button
                  className="btn-delete-room"
                  title={
                    room.currentOccupancy > 0
                      ? 'Cannot delete – Room currently occupied'
                      : 'Delete Room'
                  }
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ef4444',
                    fontSize: '1.25rem',
                    cursor:
                      room.currentOccupancy > 0
                        ? 'not-allowed'
                        : 'pointer',
                    marginLeft: '8px',
                    verticalAlign: 'middle',
                    opacity:
                      room.currentOccupancy > 0
                        ? 0.5
                        : 1
                  }}
                  disabled={room.currentOccupancy > 0}
                  onClick={e => {
                    if (room.currentOccupancy > 0) return;
                    e.stopPropagation();
                    setSelectedRoom(room);
                    setShowDeleteModal(true);
                  }}
                >
                  <span role="img" aria-label="Delete Room">🗑️</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-icon">📭</div>
          <h3>No rooms found</h3>
          <p>Try adjusting your filters to view available rooms</p>
        </div>
      )}

      {/* Room Details Modal */}
      {selectedRoom && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>Room Details</h2>
                <p className="modal-subtitle">Room {selectedRoom.roomNumber} - {selectedRoom.block}</p>
              </div>
              <button className="modal-close" onClick={handleCloseModal}>×</button>
            </div>

            <div className="modal-body">
              {modalMessage && (
                <div className={`modal-message modal-message-${modalMessageType}`}>
                  <span className="message-icon">{modalMessageType === 'success' ? '✓' : '⚠'}</span>
                  <span className="message-text">{modalMessage}</span>
                </div>
              )}
              {/* Room Information */}
              <div className="detail-section">
                <h3>Room Information</h3>
                <div className="room-details-grid">
                  <div className="detail-item">
                    <span className="detail-label">Room Number</span>
                    <span className="detail-value">{selectedRoom.roomNumber}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Block</span>
                    <span className="detail-value">{selectedRoom.block}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Floor</span>
                    <span className="detail-value">{selectedRoom.floor}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Type</span>
                    <span className="detail-value">{selectedRoom.roomType}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Capacity</span>
                    {isEditingCapacity ? (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input
                          type="number"
                          min="1"
                          value={newCapacity}
                          onChange={(e) => setNewCapacity(e.target.value)}
                          style={{
                            padding: '4px 8px',
                            width: '70px',
                            border: '1px solid #cbd5e1',
                            borderRadius: '4px',
                            fontSize: '14px'
                          }}
                        />
                        <button
                          onClick={handleSaveCapacity}
                          disabled={savingCapacity}
                          style={{
                            padding: '4px 12px',
                            backgroundColor: '#10b981',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          {savingCapacity ? 'Saving...' : '✓'}
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          disabled={savingCapacity}
                          style={{
                            padding: '4px 12px',
                            backgroundColor: '#ef4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span className="detail-value">{selectedRoom.capacity}</span>
                        <button
                          onClick={handleEditCapacity}
                          style={{
                            padding: '4px 8px',
                            backgroundColor: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                          title="Edit capacity"
                        >
                          ✎
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Available Beds</span>
                    <span className="detail-value">{selectedRoom.capacity - selectedRoom.currentOccupancy}</span>
                  </div>
                </div>
              </div>

              {/* Allocated Students */}
              <div className="detail-section">
                <h3>Allocated Students ({selectedRoom.students.length})</h3>
                {studentsLoading ? (
                  <p className="no-students">Loading students...</p>
                ) : selectedRoom.students.length > 0 ? (
                  <div className="students-list">
                    {selectedRoom.students.map(student => (
                      <div key={student.id} className="student-item">
                        <div className="student-avatar">{student.name.charAt(0)}</div>
                        <div className="student-info">
                          <p className="student-name">{student.name}</p>
                          <p className="student-meta">{student.roll} - {student.branch}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="no-students">No students allocated to this room</p>
                )}
              </div>

              {/* Room Change Requests */}
              <div className="detail-section">
                <h3>Room Change Requests</h3>
                {requestsLoading ? (
                  <p className="no-requests">Loading room change requests...</p>
                ) : selectedRoom.roomChangeRequests.length > 0 ? (
                  <div className="requests-list">
                    {selectedRoom.roomChangeRequests.map(request => (
                      <div key={request.id} className="request-item">
                        <div className="request-header">
                          <p className="request-student">{request.studentName}</p>
                          <span className={`request-status ${request.status.toLowerCase()}`}>
                            {request.status}
                          </span>
                        </div>
                        <p className="request-reason">{request.reason}</p>
                        <p className="request-date">Requested on {request.date}</p>
                        <button className="btn-view-request">View Request</button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="no-requests">No room change requests for this room</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Room Confirmation Modal */}
      {showDeleteModal && selectedRoom && (
        <div className="modal-overlay" onClick={() => !deletingRoom && setShowDeleteModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h2 style={{ color: '#ef4444' }}>Delete Room Confirmation</h2>
              <button className="modal-close" onClick={() => !deletingRoom && setShowDeleteModal(false)} disabled={deletingRoom}>×</button>
            </div>
            <div className="modal-body">
              {modalMessage && (
                <div className={`modal-message modal-message-${modalMessageType}`}>
                  <span className="message-icon">{modalMessageType === 'success' ? '✓' : '⚠'}</span>
                  <span className="message-text">{modalMessage}</span>
                </div>
              )}
              <p style={{ fontSize: '1rem', color: '#1a1a2e', marginBottom: '2rem' }}>
                Are you sure you want to delete this room? This action cannot be undone.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button
                  className="btn-secondary"
                  style={{ padding: '0.5rem 1.5rem', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontWeight: 600 }}
                  onClick={() => setShowDeleteModal(false)}
                  disabled={deletingRoom}
                >
                  Cancel
                </button>
                <button
                  className="btn-danger"
                  style={{ padding: '0.5rem 1.5rem', borderRadius: '6px', background: deletingRoom ? '#dc2626' : '#ef4444', color: '#fff', fontWeight: 600, border: 'none', opacity: deletingRoom ? 0.8 : 1 }}
                  onClick={handleDeleteRoom}
                  disabled={deletingRoom}
                >
                  {deletingRoom ? 'Deleting...' : 'Delete Room'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
};

export default Rooms;



