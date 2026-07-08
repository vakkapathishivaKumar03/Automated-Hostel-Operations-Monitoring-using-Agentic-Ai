import React, { useEffect, useState } from 'react';
import '../../styles/complaint-modal.css';

const RaiseComplaintModal = ({ onClose, onSubmit, roomNumber, blockInfo = {} }) => {
  const [step, setStep] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [formData, setFormData] = useState({
    category: '',
    categoryLabel: '',
    title: '',
    location: '',
    description: '',
    block_id: blockInfo?.blockId || null,
    block_name: blockInfo?.blockName || '',
  });

  const [errors, setErrors] = useState({});

  const categories = [
    { value: 'electrical', label: 'Electrical' },
    { value: 'plumbing', label: 'Plumbing' },
    { value: 'carpentry', label: 'Carpentry' },
    { value: 'hvac', label: 'HVAC' },
    { value: 'wifi', label: 'WiFi' },
    { value: 'other', label: 'Other' }
  ];

  useEffect(() => {
    if (roomNumber) {
      setFormData((prev) => ({
        ...prev,
        location: `Room ${roomNumber}`,
        block_id: blockInfo?.blockId || null,
        block_name: blockInfo?.blockName || '',
      }));
    }
  }, [roomNumber, blockInfo?.blockId, blockInfo?.blockName]);

  const handleCategorySelect = (category) => {
    setSelectedCategory(category.value);
    setFormData((prev) => ({
      ...prev,
      category: category.value,
      categoryLabel: category.label,
    }));
    setErrors((prev) => ({
      ...prev,
      category: '',
    }));
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setErrors((prev) => ({
      ...prev,
      [name]: '',
    }));
  };

  const validateStep1 = () => {
    if (!selectedCategory) {
      setErrors({ category: 'Please select a category' });
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    const newErrors = {};
    if (!formData.title.trim()) {
      newErrors.title = 'Issue title is required';
    }
    if (!roomNumber) {
      newErrors.location = 'Room is not assigned. Please contact the warden.';
    }
    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (step === 1 && !validateStep1()) {
      return;
    }
    if (step === 2 && !validateStep2()) {
      return;
    }
    setStep(step + 1);
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  const handleSubmit = () => {
    onSubmit(formData);
  };

  return (
    <div className="complaint-modal-overlay" onClick={onClose}>
      <div className="complaint-modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="complaint-modal-header">
          <h2>Raise a Maintenance Complaint</h2>
          <button className="complaint-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="complaint-modal-progress">
          <div className={`progress-step ${step >= 1 ? 'active' : ''}`}>
            <div className="progress-number">1</div>
            <div className="progress-label">Category</div>
          </div>
          <div className="progress-line" />
          <div className={`progress-step ${step >= 2 ? 'active' : ''}`}>
            <div className="progress-number">2</div>
            <div className="progress-label">Details</div>
          </div>
          <div className="progress-line" />
          <div className={`progress-step ${step >= 3 ? 'active' : ''}`}>
            <div className="progress-number">3</div>
            <div className="progress-label">Review</div>
          </div>
        </div>

        <div className="complaint-modal-body">
          {step === 1 && (
            <div className="step-content">
              <h3>Select Complaint Category</h3>
              <div className="category-grid">
                {categories.map((category) => (
                  <button
                    key={category.value}
                    className={`category-btn ${selectedCategory === category.value ? 'selected' : ''}`}
                    onClick={() => handleCategorySelect(category)}
                  >
                    {category.label}
                  </button>
                ))}
              </div>
              {errors.category && <div className="error-message">{errors.category}</div>}
            </div>
          )}

          {step === 2 && (
            <div className="step-content">
              <h3>Describe Your Issue</h3>
              <div className="form-group">
                <label>Issue Title *</label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  placeholder="e.g., Broken ceiling light"
                  className={errors.title ? 'error' : ''}
                />
                {errors.title && <div className="error-message">{errors.title}</div>}
              </div>

              <div className="form-group">
                <label>Room / Location *</label>
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  readOnly
                  disabled
                />
                {errors.location ? (
                  <div className="error-message">{errors.location}</div>
                ) : (
                  <small>Auto-filled from your profile</small>
                )}
              </div>

              <div className="form-group">
                <label>Block *</label>
                <input
                  type="text"
                  name="block_name"
                  value={formData.block_name}
                  readOnly
                  disabled
                />
                <small>Auto-filled from your profile</small>
              </div>

              <div className="form-group">
                <label>Description *</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Describe the issue in detail..."
                  rows="4"
                  className={errors.description ? 'error' : ''}
                />
                {errors.description && <div className="error-message">{errors.description}</div>}
              </div>

            </div>
          )}

          {step === 3 && (
            <div className="step-content">
              <h3>Review Your Complaint</h3>
              <div className="review-summary">
                <div className="review-item">
                  <span className="review-label">Category:</span>
                  <span className="review-value">{formData.categoryLabel || formData.category}</span>
                </div>
                <div className="review-item">
                  <span className="review-label">Title:</span>
                  <span className="review-value">{formData.title}</span>
                </div>
                <div className="review-item">
                  <span className="review-label">Location:</span>
                  <span className="review-value">{formData.location}</span>
                </div>
                <div className="review-item">
                  <span className="review-label">Block:</span>
                  <span className="review-value">{formData.block_name}</span>
                </div>
                <div className="review-item">
                  <span className="review-label">Description:</span>
                  <span className="review-value">{formData.description}</span>
                </div>
              </div>

              <div className="warning-message">
                ⚠️ Once submitted, your complaint will be reviewed and a technician will be assigned.
              </div>
            </div>
          )}
        </div>

        <div className="complaint-modal-footer">
          {step > 1 && (
            <button className="btn-secondary" onClick={handleBack}>
              Back
            </button>
          )}
          <div style={{ flex: 1 }} />
          {step < 3 && (
            <button className="btn-primary" onClick={handleNext} disabled={step === 1 && !selectedCategory}>
              Next
            </button>
          )}
          {step === 3 && (
            <button className="btn-primary" onClick={handleSubmit}>
              Submit Complaint
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default RaiseComplaintModal;
