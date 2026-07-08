import React, { useState, useEffect } from 'react';
import ContextActionModal from '../../components/ContextActionModal';
import '../../styles/admin-hostel-blocks.css';

const AdminHostelBlocks = () => {
  const [hostelBlocks, setHostelBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showBlocksModal, setShowBlocksModal] = useState(false);
  const [showRoomsModal, setShowRoomsModal] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [blockRooms, setBlockRooms] = useState([]);
  const [editingRoom, setEditingRoom] = useState(null);
  const [isAddingRoom, setIsAddingRoom] = useState(false);
  const [deletingRoomId, setDeletingRoomId] = useState(null);
  const [roomFormData, setRoomFormData] = useState({
    room_number: '',
    capacity: 4
  });
  const [blockFormData, setBlockFormData] = useState({
    block_name: '',
    block_gender: '',
    total_floors: 1,
    rooms_per_floor: 4,
  });
  // In-modal messages
  const [blockMessage, setBlockMessage] = useState(null);
  const [blockMessageType, setBlockMessageType] = useState('success');
  const [roomMessage, setRoomMessage] = useState(null);
  const [roomMessageType, setRoomMessageType] = useState('success');
  const [pendingRoomDelete, setPendingRoomDelete] = useState(null);
  const [pendingBlockDelete, setPendingBlockDelete] = useState(null);

  // Fetch data on component mount
  useEffect(() => {
    fetchData();
  }, []);

  // Helper functions to show messages with auto-dismiss
  const showBlockMessage = (message, type = 'success') => {
    setBlockMessage(message);
    setBlockMessageType(type);
    setTimeout(() => setBlockMessage(null), 3000);
  };

  const showRoomMessage = (message, type = 'success') => {
    setRoomMessage(message);
    setRoomMessageType(type);
    setTimeout(() => setRoomMessage(null), 3000);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch hostel blocks
      const blocksRes = await fetch('http://localhost:5000/api/admin/hostel-blocks');
      const blocksData = await blocksRes.json();
      
      if (blocksData.success && Array.isArray(blocksData.data)) {
        setHostelBlocks(blocksData.data);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setLoading(false);
    }
  };

  const handleEditBlock = (block) => {
    setSelectedBlock(block);
    setIsCreateMode(false);
    setBlockFormData({
      block_name: block.block_name,
      block_gender: block.block_gender || '',
      total_floors: block.total_floors || 1,
      rooms_per_floor: 4,
    });
    setShowBlocksModal(true);
  };

  const handleAddBlock = () => {
    setSelectedBlock(null);
    setIsCreateMode(true);
    setBlockFormData({
      block_name: '',
      block_gender: '',
      total_floors: 1,
      rooms_per_floor: 4,
    });
    setShowBlocksModal(true);
  };

  const handleBlockFormChange = (e) => {
    const { name, value } = e.target;
    setBlockFormData(prev => ({
      ...prev,
      [name]: name === 'total_floors' || name === 'rooms_per_floor' ? parseInt(value) || 1 : value
    }));
  };
  const handleViewRooms = async (block) => {
    setSelectedBlock(block);
    setShowRoomsModal(true);
    setLoading(true);
    
    try {
      const response = await fetch(`http://localhost:5000/api/admin/rooms/${block.id}`);
      const data = await response.json();
      
      if (data.success) {
        setBlockRooms(data.data);
      } else {
        showRoomMessage('Failed to fetch rooms', 'error');
      }
    } catch (error) {
      console.error('Error fetching rooms:', error);
      showRoomMessage('Failed to fetch rooms', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEditRoom = (room) => {
    setEditingRoom(room);
    setRoomFormData({
      room_number: room.room_number,
      capacity: room.capacity
    });
  };

  const handleRoomFormChange = (e) => {
    const { name, value } = e.target;
    setRoomFormData(prev => ({
      ...prev,
      [name]: name === 'capacity' ? parseInt(value) || 1 : value
    }));
  };

  const handleSaveRoom = async () => {
    if (!roomFormData.room_number) {
      showRoomMessage('Room number is required', 'error');
      return;
    }

    setSubmitting(true);
    try {
      if (isAddingRoom) {
        // Add new room
        const response = await fetch(`http://localhost:5000/api/admin/rooms`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            block_id: selectedBlock.id,
            room_number: roomFormData.room_number,
            capacity: roomFormData.capacity,
            status: 'available'
          })
        });

        const data = await response.json();

        if (data.success) {
          showRoomMessage('Room created successfully', 'success');
          // Refresh rooms list
          await handleViewRooms(selectedBlock);
          setIsAddingRoom(false);
          setRoomFormData({ room_number: '', capacity: 4 });
        } else {
          showRoomMessage(data.message || 'Failed to create room', 'error');
        }
      } else {
        // Update existing room
        const response = await fetch(`http://localhost:5000/api/admin/rooms/${editingRoom.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(roomFormData)
        });

        const data = await response.json();

        if (data.success) {
          showRoomMessage('Room updated successfully', 'success');
          // Refresh rooms list
          await handleViewRooms(selectedBlock);
          setEditingRoom(null);
        } else {
          showRoomMessage(data.message || 'Failed to update room', 'error');
        }
      }
    } catch (error) {
      console.error('Error saving room:', error);
      showRoomMessage('Failed to save room', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddRoom = () => {
    setIsAddingRoom(true);
    setEditingRoom(null);
    setRoomFormData({ room_number: '', capacity: 4 });
  };

  const handleDeleteRoomClick = (room) => {
    setPendingRoomDelete(room);
  };

  const handleDeleteRoomConfirm = async () => {
    if (!pendingRoomDelete) return;

    setDeletingRoomId(pendingRoomDelete.id);
    try {
      const response = await fetch(`http://localhost:5000/api/admin/rooms/${pendingRoomDelete.id}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        showRoomMessage('Room deleted successfully', 'success');
        // Refresh rooms list
        await handleViewRooms(selectedBlock);
      } else {
        showRoomMessage(data.message || 'Failed to delete room', 'error');
      }
    } catch (error) {
      console.error('Error deleting room:', error);
      showRoomMessage('Failed to delete room', 'error');
    } finally {
      setDeletingRoomId(null);
      setPendingRoomDelete(null);
    }
  };

  const handleCancelAddRoom = () => {
    setIsAddingRoom(false);
    setRoomFormData({ room_number: '', capacity: 4 });
  };
  const handleSaveBlock = async () => {
    if (!blockFormData.block_name || !blockFormData.block_gender || blockFormData.total_floors < 1) {
      showBlockMessage('Please fill in all required fields', 'error');
      return;
    }

    setSubmitting(true);
    try {
      if (isCreateMode) {
        const blockRes = await fetch('http://localhost:5000/api/admin/hostel-blocks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            block_name: blockFormData.block_name,
            block_gender: blockFormData.block_gender,
            total_floors: blockFormData.total_floors,
            rooms_per_floor: blockFormData.rooms_per_floor
          })
        });

        const blockData = await blockRes.json();

        if (!blockData.success) {
          showBlockMessage(blockData.message || 'Failed to create block', 'error');
          setSubmitting(false);
          return;
        }

        showBlockMessage(blockData.message || 'Block created successfully', 'success');
        await fetchData();
        setShowBlocksModal(false);
        setIsCreateMode(false);
      } else if (selectedBlock) {
        // Update block details
        const blockRes = await fetch(`http://localhost:5000/api/admin/hostel-blocks/${selectedBlock.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            block_name: blockFormData.block_name,
            block_gender: blockFormData.block_gender,
            total_floors: blockFormData.total_floors
          })
        });

        const blockData = await blockRes.json();

        if (!blockData.success) {
          showBlockMessage(blockData.message || 'Failed to update block', 'error');
          setSubmitting(false);
          return;
        }

        // Update rooms in block
        const roomsRes = await fetch(`http://localhost:5000/api/admin/rooms/bulk-update`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            block_id: selectedBlock.id,
            num_floors: blockFormData.total_floors,
            rooms_per_floor: blockFormData.rooms_per_floor
          })
        });

        const roomsData = await roomsRes.json();

        if (roomsData.success) {
          showBlockMessage(`Block updated! ${roomsData.message}`, 'success');
          await fetchData(); // Refresh data
          setShowBlocksModal(false);
          setSelectedBlock(null);
        } else {
          showBlockMessage(roomsData.message || 'Failed to update rooms', 'error');
        }
      }
    } catch (error) {
      console.error('Error saving block:', error);
      showBlockMessage('Failed to save block', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteBlockClick = (block) => {
    setPendingBlockDelete(block);
  };

  const handleDeleteBlockConfirm = async () => {
    if (!pendingBlockDelete) return;

    setSubmitting(true);
    try {
      const response = await fetch(`http://localhost:5000/api/admin/hostel-blocks/${pendingBlockDelete.id}`, {
        method: 'DELETE'
      });
      const data = await response.json();

      if (data.success) {
        showBlockMessage(data.message || 'Block deleted successfully', 'success');
        await fetchData();
      } else {
        showBlockMessage(data.message || 'Failed to delete block', 'error');
      }
    } catch (error) {
      console.error('Error deleting block:', error);
      showBlockMessage('Failed to delete block', 'error');
      setSubmitting(false);
      return;
    } finally {
      setSubmitting(false);
      setPendingBlockDelete(null);
    }
  };

  return (
    <div className="admin-hostel-blocks">
      <div className="page-header page-header-card">
        <div className="header-content page-header-text">
          <h1>🏢 Hostel Blocks Management</h1>
          <p className="header-subtitle">
            Manage hostel building blocks, floors, and room configurations
          </p>
        </div>
        <div className="page-header-action">
          <button className="btn-add" onClick={handleAddBlock}>
            Add Block
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading hostel blocks...</p>
        </div>
      ) : hostelBlocks && hostelBlocks.length > 0 ? (
        <div className="table-container">
          <table className="blocks-table">
            <thead>
              <tr>
                <th>Block Name</th>
                <th>Block Type</th>
                <th>Total Floors</th>
                <th>Rooms per Floor</th>
                <th>Total Rooms</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {hostelBlocks.map((block) => (
                <tr key={block.id}>
                  <td data-label="Block Name">
                    <div className="block-name-cell">
                      <span className="block-icon" aria-hidden="true">🏢</span>
                      <span>{block.block_name}</span>
                    </div>
                  </td>
                  <td data-label="Block Type">{block.block_gender === 'female' ? 'Girls' : 'Boys'}</td>
                  <td data-label="Total Floors">{block.total_floors}</td>
                  <td data-label="Rooms per Floor">{block.rooms_per_floor || '0'}</td>
                  <td className="total-rooms" data-label="Total Rooms">
                    {block.total_rooms || 0} rooms
                  </td>
                  <td className="action-buttons" data-label="Actions">
                    <button
                      className="btn-view"
                      onClick={() => handleViewRooms(block)}
                      title="View and edit rooms"
                    >
                      🚪 View Rooms
                    </button>
                    <button
                      className="btn-edit"
                      onClick={() => handleEditBlock(block)}
                      title="Edit block configuration"
                    >
                      ✏️ Edit Block
                    </button>
                    <button
                      className="btn-delete"
                      onClick={() => handleDeleteBlockClick(block)}
                      title="Delete block"
                      disabled={submitting}
                    >
                      🗑️ Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state-container">
          <div className="empty-state">
            <div className="empty-icon">🏢</div>
            <h3>No hostel blocks found</h3>
            <p>No hostel blocks are currently configured in the system</p>
          </div>
        </div>
      )}

      {/* Hostel Block Edit Modal */}
      {showBlocksModal && (selectedBlock || isCreateMode) && (
        <div className="modal-overlay" onClick={() => setShowBlocksModal(false)}>
          <div className="modal-content modal-md" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{isCreateMode ? '➕ Add Hostel Block' : '✏️ Edit Hostel Block'}</h2>
              <button className="btn-close" onClick={() => setShowBlocksModal(false)}>×</button>
            </div>
            <div className="modal-body">
              {blockMessage && (
                <div className={`modal-message modal-message-${blockMessageType}`}>
                  <span className="message-icon">{blockMessageType === 'success' ? '✓' : '⚠'}</span>
                  <span className="message-text">{blockMessage}</span>
                </div>
              )}
              {!isCreateMode && selectedBlock && (
                <div className="modal-info">
                  Editing: <strong>{selectedBlock.block_name}</strong>
                </div>
              )}

              <div className="form-group">
                <label>Block Name *</label>
                <input
                  type="text"
                  className="form-input"
                  name="block_name"
                  value={blockFormData.block_name}
                  onChange={handleBlockFormChange}
                  placeholder="e.g., Block A"
                />
              </div>

              <div className="form-group">
                <label>Block Type *</label>
                <select
                  className="form-input"
                  name="block_gender"
                  value={blockFormData.block_gender}
                  onChange={handleBlockFormChange}
                >
                  <option value="">Select Block Type</option>
                  <option value="male">Boys Hostel</option>
                  <option value="female">Girls Hostel</option>
                </select>
              </div>

              <div className="form-group-row">
                <div className="form-group">
                  <label>Total Floors *</label>
                  <input
                    type="number"
                    className="form-input"
                    name="total_floors"
                    min="1"
                    max="10"
                    value={blockFormData.total_floors}
                    onChange={handleBlockFormChange}
                  />
                  <small className="form-hint">Number of floors in this block (1-10)</small>
                </div>
                <div className="form-group">
                  <label>Rooms per Floor *</label>
                  <input
                    type="number"
                    className="form-input"
                    name="rooms_per_floor"
                    min="1"
                    max="50"
                    value={blockFormData.rooms_per_floor}
                    onChange={handleBlockFormChange}
                  />
                  <small className="form-hint">Rooms on each floor (1-50)</small>
                </div>
              </div>

              <div className="calculation-summary">
                <div className="summary-card">
                  <div className="summary-icon">📊</div>
                  <div className="summary-content">
                    <p className="summary-label">Total Rooms</p>
                    <p className="summary-value">
                      {blockFormData.total_floors} floors × {blockFormData.rooms_per_floor} rooms/floor 
                      = <strong>{blockFormData.total_floors * blockFormData.rooms_per_floor}</strong> rooms
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => setShowBlocksModal(false)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleSaveBlock}
                disabled={
                  submitting ||
                  !blockFormData.block_name ||
                  !blockFormData.block_gender ||
                  blockFormData.total_floors < 1 ||
                  blockFormData.rooms_per_floor < 1
                }
              >
                {submitting ? 'Saving...' : isCreateMode ? 'Create Block' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rooms Management Modal */}
      {showRoomsModal && selectedBlock && (
        <div className="modal-overlay" onClick={() => setShowRoomsModal(false)}>
          <div className="modal-content modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>🚪 Rooms in {selectedBlock.block_name}</h2>
                <p className="modal-subtitle">Manage rooms for this block</p>
              </div>
              <button className="btn-close" onClick={() => setShowRoomsModal(false)}>×</button>
            </div>
            <div className="modal-body">
              {roomMessage && (
                <div className={`modal-message modal-message-${roomMessageType}`}>
                  <span className="message-icon">{roomMessageType === 'success' ? '✓' : '⚠'}</span>
                  <span className="message-text">{roomMessage}</span>
                </div>
              )}
              {isAddingRoom && (
                <div className="room-card" style={{ marginBottom: '1rem', border: '2px solid #10b981' }}>
                  <div className="room-edit-form">
                    <h3 style={{ marginBottom: '1rem', color: '#10b981' }}>Add New Room</h3>
                    <div className="form-group">
                      <label>Room Number</label>
                      <input
                        type="text"
                        className="form-input"
                        name="room_number"
                        value={roomFormData.room_number}
                        onChange={handleRoomFormChange}
                        placeholder="e.g., 101, 102"
                      />
                    </div>
                    <div className="form-group">
                      <label>Capacity</label>
                      <input
                        type="number"
                        className="form-input"
                        name="capacity"
                        min="1"
                        max="4"
                        value={roomFormData.capacity}
                        onChange={handleRoomFormChange}
                      />
                    </div>
                    <div className="room-actions">
                      <button
                        className="btn-save"
                        onClick={handleSaveRoom}
                        disabled={submitting}
                        style={{ background: '#10b981' }}
                      >
                        {submitting ? 'Creating...' : '✓ Create Room'}
                      </button>
                      <button
                        className="btn-cancel"
                        onClick={handleCancelAddRoom}
                        disabled={submitting}
                      >
                        ✕ Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {loading ? (
                <div className="loading-container">
                  <div className="loading-spinner"></div>
                  <p>Loading rooms...</p>
                </div>
              ) : blockRooms.length > 0 ? (
                <div className="rooms-grid">
                  {blockRooms.map((room) => (
                    <div key={room.id} className="room-card">
                      {editingRoom && editingRoom.id === room.id ? (
                        <div className="room-edit-form">
                          <div className="form-group">
                            <label>Room Number</label>
                            <input
                              type="text"
                              className="form-input"
                              name="room_number"
                              value={roomFormData.room_number}
                              onChange={handleRoomFormChange}
                            />
                          </div>
                          <div className="form-group">
                            <label>Capacity</label>
                            <input
                              type="number"
                              className="form-input"
                              name="capacity"
                              min="1"
                              max="4"
                              value={roomFormData.capacity}
                              onChange={handleRoomFormChange}
                            />
                          </div>
                          <div className="room-actions">
                            <button
                              className="btn-save"
                              onClick={handleSaveRoom}
                              disabled={submitting}
                            >
                              {submitting ? 'Saving...' : '✓ Save'}
                            </button>
                            <button
                              className="btn-cancel"
                              onClick={() => setEditingRoom(null)}
                              disabled={submitting}
                            >
                              ✕ Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="room-info">
                            <h3 className="room-number">Room {room.room_number}</h3>
                            <p className="room-capacity">👥 Capacity: {room.capacity}</p>
                            <span className={`room-status status-${room.status}`}>
                              {room.status}
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                              className="btn-edit-room"
                              onClick={() => handleEditRoom(room)}
                            >
                              ✏️ Edit
                            </button>
                            <button
                              className="btn-delete-room"
                              onClick={() => handleDeleteRoomClick(room)}
                              disabled={deletingRoomId === room.id}
                              style={{
                                flex: 1,
                                background: '#fee2e2',
                                color: '#991b1b',
                                padding: '0.5rem',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: deletingRoomId === room.id ? 'not-allowed' : 'pointer',
                                fontSize: '0.875rem',
                                fontWeight: 600,
                                transition: 'all 0.2s'
                              }}
                            >
                              {deletingRoomId === room.id ? '🗑️ Deleting...' : '🗑️ Delete'}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-icon">🚪</div>
                  <p>No rooms found in this block</p>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                className="btn-primary"
                onClick={handleAddRoom}
                disabled={isAddingRoom || editingRoom !== null}
                style={{ minWidth: '120px' }}
              >
                Add Room
              </button>
              <button
                className="btn-secondary"
                onClick={() => {
                  setShowRoomsModal(false);
                  setEditingRoom(null);
                  setIsAddingRoom(false);
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <ContextActionModal
        open={!!pendingBlockDelete}
        title="Delete Hostel Block"
        message={pendingBlockDelete ? `Delete ${pendingBlockDelete.block_name}? This will remove all rooms in the block.` : ''}
        confirmText="Delete Block"
        cancelText="Cancel"
        tone="danger"
        onConfirm={handleDeleteBlockConfirm}
        onClose={() => setPendingBlockDelete(null)}
      />

      <ContextActionModal
        open={!!pendingRoomDelete}
        title="Delete Room"
        message={pendingRoomDelete ? `Delete Room ${pendingRoomDelete.room_number}?` : ''}
        confirmText="Delete Room"
        cancelText="Keep Room"
        tone="danger"
        onConfirm={handleDeleteRoomConfirm}
        onClose={() => setPendingRoomDelete(null)}
      />
    </div>
  );
};

export default AdminHostelBlocks;



