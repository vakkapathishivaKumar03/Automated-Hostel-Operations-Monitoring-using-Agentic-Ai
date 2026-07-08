import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser } from '../../utils/auth';
import '../../styles/student-parcels.css';

const Parcels = () => {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [studentName, setStudentName] = useState('');
  const [parcels, setParcels] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    
    setStudentName(user.name || 'Student');
    fetchStudentParcels();
  }, [user?.userId, navigate]);

  const fetchStudentParcels = async () => {
    if (!user?.userId || loading) return;

    setLoading(true);
    try {
      console.log('Fetching parcels for user_id:', user.userId);
      const response = await fetch(
        `http://localhost:5000/api/student/parcels/${user.userId}`
      );
      const data = await response.json();
      
      console.log('Parcels API response:', data);
      
      if (data.success && data.data) {
        // Transform API data to match component structure
        const transformedParcels = data.data.map((p) => ({
          id: p.id,
          name: p.parcel_type || 'Package',
          courier: p.courier_name || 'Not specified',
          arrivalDate: p.received_date ? new Date(p.received_date).toISOString().split('T')[0] : '',
          status: p.status === 'collected' ? 'collected' : 'pending', // received or notified = pending
          senderName: p.sender_name || '',
          trackingNumber: p.tracking_number || '',
          remarks: p.remarks || ''
        }));
        
        console.log('Transformed parcels:', transformedParcels);
        setParcels(transformedParcels);
      } else {
        console.error('API error:', data.message);
      }
    } catch (error) {
      console.error('Error fetching parcels:', error);
    } finally {
      setLoading(false);
    }
  };

  const pendingParcels = parcels.filter((p) => p.status === 'pending');
  const collectedParcels = parcels.filter((p) => p.status === 'collected');

  return (
    <>
          <main className="student-main">
          <header className="parcels-header">
            <div className="parcels-header-text">
              <h1 className="parcels-title">My Parcels</h1>
              <p className="parcels-subtitle">
                Showing parcels for {studentName}. Collect from the Security Desk.
              </p>
            </div>
            <button 
              className="parcels-refresh-btn"
              onClick={fetchStudentParcels}
              disabled={loading}
            >
              {loading ? 'Refreshing...' : '🔄 Refresh'}
            </button>
          </header>

          <div className="parcels-content">
            <section className="parcels-section">
              <h2 className="section-title">
                Waiting for Collection <span className="count-badge">{pendingParcels.length}</span>
              </h2>

              {pendingParcels.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📭</div>
                  <div className="empty-text">No parcels waiting for collection</div>
                </div>
              ) : (
                <div className="parcels-grid">
                  {pendingParcels.map((parcel) => (
                    <div key={parcel.id} className="parcel-card pending">
                      <div className="parcel-header">
                        <div className="parcel-info">
                          <div className="parcel-courier">{parcel.courier}</div>
                          <div className="parcel-name">{parcel.name}</div>
                        </div>
                        <span className="parcel-status pending-status">Pending</span>
                      </div>
                      <div className="parcel-details">
                        <div className="detail-item">
                          <span className="detail-label">Arrived:</span>
                          <span className="detail-value">{parcel.arrivalDate}</span>
                        </div>
                      </div>
                      <div className="parcel-action">Collect from Security Desk</div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="parcels-section">
              <h2 className="section-title">
                Collected <span className="count-badge">{collectedParcels.length}</span>
              </h2>

              {collectedParcels.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📫</div>
                  <div className="empty-text">No collected parcels yet</div>
                </div>
              ) : (
                <div className="parcels-grid">
                  {collectedParcels.map((parcel) => (
                    <div key={parcel.id} className="parcel-card collected">
                      <div className="parcel-header">
                        <div className="parcel-info">
                          <div className="parcel-courier">{parcel.courier}</div>
                          <div className="parcel-name">{parcel.name}</div>
                        </div>
                        <span className="parcel-status collected-status">Collected</span>
                      </div>
                      <div className="parcel-details">
                        <div className="detail-item">
                          <span className="detail-label">Arrived:</span>
                          <span className="detail-value">{parcel.arrivalDate}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
          </main>
    </>
  );
};

export default Parcels;

