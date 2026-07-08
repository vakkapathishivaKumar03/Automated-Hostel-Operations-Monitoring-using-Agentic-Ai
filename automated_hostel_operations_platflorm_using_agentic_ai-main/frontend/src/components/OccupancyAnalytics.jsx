import React, { useMemo } from 'react';
import '../styles/occupancy-analytics.css';

const OccupancyAnalytics = ({ roomsData }) => {
  // Calculate occupancy statistics
  const analytics = useMemo(() => {
    if (!roomsData || roomsData.length === 0) {
      return {
        totalCapacity: 0,
        currentOccupancy: 0,
        occupancyPercentage: 0,
        vacantBeds: 0,
        fullyOccupiedRooms: 0,
        partiallyOccupiedRooms: 0,
        vacantRooms: 0,
      };
    }

    const totalCapacity = roomsData.reduce((sum, room) => sum + room.capacity, 0);
    const currentOccupancy = roomsData.reduce((sum, room) => sum + room.currentOccupancy, 0);
    const occupancyPercentage = totalCapacity > 0 ? Math.round((currentOccupancy / totalCapacity) * 100) : 0;
    const vacantBeds = totalCapacity - currentOccupancy;
    
    let fullyOccupiedRooms = 0;
    let partiallyOccupiedRooms = 0;
    let vacantRooms = 0;

    roomsData.forEach(room => {
      if (room.currentOccupancy === room.capacity) {
        fullyOccupiedRooms++;
      } else if (room.currentOccupancy > 0) {
        partiallyOccupiedRooms++;
      } else {
        vacantRooms++;
      }
    });

    return {
      totalCapacity,
      currentOccupancy,
      occupancyPercentage,
      vacantBeds,
      fullyOccupiedRooms,
      partiallyOccupiedRooms,
      vacantRooms,
    };
  }, [roomsData]);

  // Determine occupancy color
  const getOccupancyColor = (percentage) => {
    if (percentage >= 90) return '#ef4444'; // Red - Critical
    if (percentage >= 75) return '#f59e0b'; // Orange - High
    if (percentage >= 50) return '#3b82f6'; // Blue - Medium
    return '#10b981'; // Green - Low
  };

  return (
    <div className="occupancy-analytics">
      {/* Total Capacity Card */}
      <div className="analytics-card capacity-card">
        <div className="card-header">
          <span className="card-icon">🏛️</span>
          <span className="card-label">Total Capacity</span>
        </div>
        <div className="card-value">{analytics.totalCapacity}</div>
        <div className="card-metric">Beds</div>
      </div>

      {/* Current Occupancy % Card */}
      <div className="analytics-card occupancy-card">
        <div className="card-header">
          <span className="card-icon">📊</span>
          <span className="card-label">Occupancy</span>
        </div>
        <div className="card-value-with-color" style={{ color: getOccupancyColor(analytics.occupancyPercentage) }}>
          {analytics.occupancyPercentage}%
        </div>
        <div className="occupancy-bar-container">
          <div
            className="occupancy-bar-fill"
            style={{
              width: `${analytics.occupancyPercentage}%`,
              backgroundColor: getOccupancyColor(analytics.occupancyPercentage),
            }}
          />
        </div>
        <div className="card-metric">
          {analytics.currentOccupancy} / {analytics.totalCapacity} occupied
        </div>
      </div>

      {/* Vacant Beds Card */}
      <div className="analytics-card vacant-beds-card">
        <div className="card-header">
          <span className="card-icon">🛏️</span>
          <span className="card-label">Vacant Beds</span>
        </div>
        <div className="card-value">{analytics.vacantBeds}</div>
        <div className="card-metric">Available</div>
      </div>

      {/* Fully Occupied Rooms Card */}
      <div className="analytics-card fully-occupied-card">
        <div className="card-header">
          <span className="card-icon">🔴</span>
          <span className="card-label">Fully Occupied</span>
        </div>
        <div className="card-value">{analytics.fullyOccupiedRooms}</div>
        <div className="card-metric">Rooms</div>
      </div>

      {/* Partially Occupied Rooms Card */}
      <div className="analytics-card partially-occupied-card">
        <div className="card-header">
          <span className="card-icon">🟡</span>
          <span className="card-label">Partially Occupied</span>
        </div>
        <div className="card-value">{analytics.partiallyOccupiedRooms}</div>
        <div className="card-metric">Rooms</div>
      </div>

      {/* Vacant Rooms Card */}
      <div className="analytics-card vacant-rooms-card">
        <div className="card-header">
          <span className="card-icon">🟢</span>
          <span className="card-label">Vacant Rooms</span>
        </div>
        <div className="card-value">{analytics.vacantRooms}</div>
        <div className="card-metric">Available</div>
      </div>
    </div>
  );
};

export default OccupancyAnalytics;
