import React, { useState, useEffect } from 'react';
import Navbar from '../../components/Navbar';
import '../../styles/registration.css';

const StudentRegistration = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [hostelBlocks, setHostelBlocks] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loadingBlocks, setLoadingBlocks] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [formData, setFormData] = useState({
    // Step 1: Personal Information
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    rollNumber: '',
    collegeName: '',
    collegeOther: '',
    branch: '',
    year: '',
    gender: '',
    parentName: '',
    parentPhone: '',
    parentEmail: '',
    
    // Step 2: Hostel Selection
    hostelBlock: '',
    floorPreference: '',
    
    // Step 3: Fee Payment Details
    feeAmount: '',
    paymentMode: '',
    transactionId: '',
    paymentDate: '',
    receiptFile: '',
    paymentProofUrl: '',  // URL of uploaded payment proof
  });

  // Fetch academic settings on mount
  useEffect(() => {
    const fetchAcademicSettings = async () => {
      try {
        const [collegesRes, branchesRes] = await Promise.all([
          fetch('http://localhost:5000/api/settings/colleges'),
          fetch('http://localhost:5000/api/settings/branches')
        ]);
        const [collegesData, branchesData] = await Promise.all([
          collegesRes.json(),
          branchesRes.json()
        ]);

        if (collegesData.success && Array.isArray(collegesData.data)) {
          setColleges(collegesData.data);
        }
        if (branchesData.success && Array.isArray(branchesData.data)) {
          setBranches(branchesData.data);
        }
      } catch (error) {
        console.error('Error fetching academic settings:', error);
      }
    };

    fetchAcademicSettings();
  }, []);

  // Fetch hostel blocks based on selected student gender
  useEffect(() => {
    const selectedGender = (formData.gender || '').toLowerCase();

    if (!selectedGender) {
      setHostelBlocks([]);
      return;
    }

    if (!['male', 'female'].includes(selectedGender)) {
      setHostelBlocks([]);
      return;
    }

    const fetchHostelBlocks = async () => {
      setLoadingBlocks(true);
      try {
        const response = await fetch(`http://localhost:5000/api/blocks?gender=${selectedGender}`);
        const data = await response.json();

        if (data.success && Array.isArray(data.data)) {
          setHostelBlocks(data.data);
        } else {
          setHostelBlocks([]);
        }
      } catch (error) {
        console.error('Error fetching hostel blocks:', error);
        setHostelBlocks([]);
      } finally {
        setLoadingBlocks(false);
      }
    };

    fetchHostelBlocks();
  }, [formData.gender]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
      ...(name === 'collegeName' && value !== 'Other' ? { collegeOther: '' } : {}),
      ...(name === 'gender' ? { hostelBlock: '' } : {})
    }));
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Update UI with filename
    setFormData((prev) => ({
      ...prev,
      receiptFile: file.name,
    }));

    // Upload file to backend
    setUploadingFile(true);
    try {
      const formDataForUpload = new FormData();
      formDataForUpload.append('file', file);

      const response = await fetch('http://localhost:5000/api/upload/payment-proof', {
        method: 'POST',
        body: formDataForUpload,
      });

      const data = await response.json();

      if (data.success) {
        // Store the file path returned from server
        setFormData((prev) => ({
          ...prev,
          paymentProofUrl: data.file_path,
        }));
        console.log('File uploaded successfully:', data.file_path);
      } else {
        alert(data.message || 'File upload failed');
        setFormData((prev) => ({
          ...prev,
          receiptFile: '',
          paymentProofUrl: '',
        }));
      }
    } catch (error) {
      console.error('File upload error:', error);
      alert('Error uploading file. Please try again.');
      setFormData((prev) => ({
        ...prev,
        receiptFile: '',
        paymentProofUrl: '',
      }));
    } finally {
      setUploadingFile(false);
    }
  };

  const handleNext = (e) => {
    if (e) {
      e.preventDefault();
    }

    if (currentStep === 1) {
      if (!formData.fullName || !formData.email || !formData.phone || !formData.password ||
          !formData.confirmPassword || !formData.rollNumber || !formData.collegeName ||
          !formData.branch || !formData.year || !formData.gender || !formData.parentName ||
          !formData.parentPhone || !formData.parentEmail) {
        alert('Please fill in all required fields');
        return;
      }

      if (formData.collegeName === 'Other' && !formData.collegeOther.trim()) {
        alert('Please specify your college name');
        return;
      }

      if (formData.password !== formData.confirmPassword) {
        alert('Passwords do not match');
        return;
      }

      if (formData.password.length < 6) {
        alert('Password must be at least 6 characters long');
        return;
      }

      if (!['male', 'female'].includes((formData.gender || '').toLowerCase())) {
        alert('Please select a valid gender (Male or Female)');
        return;
      }
    }

    if (currentStep === 2) {
      if (!formData.hostelBlock) {
        alert('Please select a hostel block to continue');
        return;
      }
    }

    if (currentStep === 3) {
      if (!formData.feeAmount || !formData.paymentMode || !formData.transactionId || !formData.paymentDate) {
        alert('Please complete the fee payment details');
        return;
      }
    }

    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
      window.scrollTo(0, 0);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      window.scrollTo(0, 0);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (currentStep !== 4) {
      return;
    }
    
    // Validate all required fields
    if (!formData.fullName || !formData.email || !formData.phone || !formData.password || 
        !formData.confirmPassword || !formData.rollNumber || !formData.collegeName || 
        !formData.branch || !formData.year || !formData.gender || !formData.parentName || !formData.parentPhone || 
        !formData.parentEmail || !formData.hostelBlock) {
      alert('Please fill in all required fields');
      return;
    }

    if (formData.collegeName === 'Other' && !formData.collegeOther.trim()) {
      alert('Please specify your college name');
      return;
    }

    // Validate password match
    if (formData.password !== formData.confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    // Validate password strength
    if (formData.password.length < 6) {
      alert('Password must be at least 6 characters long');
      return;
    }

    if (!['male', 'female'].includes((formData.gender || '').toLowerCase())) {
      alert('Please select a valid gender (Male or Female)');
      return;
    }

    setSubmitting(true);
    try {
      const resolvedCollegeName = formData.collegeName === 'Other'
        ? formData.collegeOther.trim()
        : formData.collegeName;

      const response = await fetch('http://localhost:5000/api/student/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: formData.fullName,
          email: formData.email,
          phone: formData.phone,
          password: formData.password,
          rollNumber: formData.rollNumber,
          collegeName: resolvedCollegeName,
          branch: formData.branch,
          year: formData.year,
          gender: formData.gender,
          parentName: formData.parentName,
          parentPhone: formData.parentPhone,
          parentEmail: formData.parentEmail,
          hostelBlock: formData.hostelBlock,
          floorPreference: formData.floorPreference || null,
          paymentProofUrl: formData.paymentProofUrl || null,  // Include payment proof URL if available
        })
      });

      const data = await response.json();

      if (data.success) {
        setRegistrationSuccess(true);
        // Reset form after successful submission
        setTimeout(() => {
          window.location.href = '/student/dashboard';
        }, 2000);
      } else {
        alert(data.message || 'Registration failed. Please try again.');
      }
    } catch (error) {
      console.error('Registration error:', error);
      alert('An error occurred during registration. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFormSubmit = (e) => {
    if (currentStep !== 4) {
      e.preventDefault();
      return;
    }

    handleSubmit(e);
  };

  const steps = [
    { number: 1, label: 'Personal Info', icon: '👤' },
    { number: 2, label: 'Hostel Selection', icon: '🏢' },
    { number: 3, label: 'Fee Payment', icon: '💳' },
    { number: 4, label: 'Confirmation', icon: '✓' },
  ];

  return (
    <div className="registration-page">
      <Navbar />

      <div className="registration-container">
        {/* Progress Stepper */}
        <div className="stepper-container">
          <div className="stepper">
            {steps.map((step, index) => (
              <div key={step.number} className="stepper-group">
                <div
                  className={`stepper-item ${
                    step.number === currentStep ? 'active' : ''
                  } ${step.number < currentStep ? 'completed' : ''}`}
                >
                  <div className="stepper-icon">
                    {step.number < currentStep ? '✓' : step.icon}
                  </div>
                  <div className="stepper-label">{step.label}</div>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`stepper-line ${
                      step.number < currentStep ? 'completed' : ''
                    }`}
                  ></div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Registration Form */}
        <div className="registration-card">
          <form onSubmit={handleFormSubmit}>
            {/* STEP 1: PERSONAL INFORMATION */}
            {currentStep === 1 && (
              <div className="form-step">
                <div className="step-header">
                  <h2 className="step-title">Student Registration</h2>
                  <p className="step-subtitle">Complete your registration in 4 easy steps</p>
                </div>

                <div className="form-section">
                  <h3 className="section-title">Student Details</h3>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Full Name *</label>
                      <input
                        type="text"
                        name="fullName"
                        className="form-input"
                        placeholder="Enter your full name"
                        value={formData.fullName}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Email Address *</label>
                      <input
                        type="email"
                        name="email"
                        className="form-input"
                        placeholder="your.email@college.edu"
                        value={formData.email}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Phone Number *</label>
                      <input
                        type="tel"
                        name="phone"
                        className="form-input"
                        placeholder="10-digit phone number"
                        value={formData.phone}
                        onChange={handleInputChange}
                        required
                        pattern="[0-9]{10}"
                        title="Please enter a valid 10-digit phone number"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Roll Number *</label>
                      <input
                        type="text"
                        name="rollNumber"
                        className="form-input"
                        placeholder="Your roll number"
                        value={formData.rollNumber}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">College *</label>
                      <select
                        name="collegeName"
                        className="form-select"
                        value={formData.collegeName}
                        onChange={handleInputChange}
                        required
                      >
                        <option value="">Select College</option>
                        {colleges.map((college) => (
                          <option key={college.id} value={college.name}>
                            {college.name}
                          </option>
                        ))}
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Gender *</label>
                      <select
                        name="gender"
                        className="form-select"
                        value={formData.gender}
                        onChange={handleInputChange}
                        required
                      >
                        <option value="">Select Gender</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                      </select>
                    </div>
                  </div>

                  {formData.collegeName === 'Other' && (
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Specify College *</label>
                        <input
                          type="text"
                          name="collegeOther"
                          className="form-input"
                          placeholder="Enter your college name"
                          value={formData.collegeOther}
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                    </div>
                  )}

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Branch *</label>
                      <select
                        name="branch"
                        className="form-select"
                        value={formData.branch}
                        onChange={handleInputChange}
                        required
                      >
                        <option value="">Select Branch</option>
                        {branches.map((branch) => (
                          <option key={branch.id} value={branch.name}>
                            {branch.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Year *</label>
                      <select
                        name="year"
                        className="form-select"
                        value={formData.year}
                        onChange={handleInputChange}
                        required
                      >
                        <option value="">Select Year</option>
                        <option value="1st Year">1st Year</option>
                        <option value="2nd Year">2nd Year</option>
                        <option value="3rd Year">3rd Year</option>
                        <option value="4th Year">4th Year</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Password *</label>
                      <input
                        type="password"
                        name="password"
                        className="form-input"
                        placeholder="Create a password (min 6 characters)"
                        value={formData.password}
                        onChange={handleInputChange}
                        required
                        minLength="6"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Confirm Password *</label>
                      <input
                        type="password"
                        name="confirmPassword"
                        className="form-input"
                        placeholder="Re-enter your password"
                        value={formData.confirmPassword}
                        onChange={handleInputChange}
                        required
                        minLength="6"
                      />
                    </div>
                  </div>
                </div>

                <div className="form-section">
                  <h3 className="section-title">Parent / Guardian Details</h3>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Parent / Guardian Name *</label>
                      <input
                        type="text"
                        name="parentName"
                        className="form-input"
                        placeholder="Enter parent/guardian name"
                        value={formData.parentName}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Parent Phone *</label>
                      <input
                        type="tel"
                        name="parentPhone"
                        className="form-input"
                        placeholder="10-digit phone number"
                        value={formData.parentPhone}
                        onChange={handleInputChange}
                        required
                        pattern="[0-9]{10}"
                        title="Please enter a valid 10-digit phone number"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Parent Email *</label>
                    <input
                      type="email"
                      name="parentEmail"
                      className="form-input"
                      placeholder="parent.email@example.com"
                      value={formData.parentEmail}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                </div>

                <div className="info-box">
                  <p>
                    📋 Please enter your details exactly as they appear in your college records.
                    This information will be verified during approval.
                  </p>
                </div>
              </div>
            )}

            {/* STEP 2: HOSTEL SELECTION */}
            {currentStep === 2 && (
              <div className="form-step">
                <div className="step-header">
                  <h2 className="step-title">Hostel Selection</h2>
                  <p className="step-subtitle">Choose your preferred hostel block and room type</p>
                </div>

                <div className="info-box">
                  <p>
                    🏢 Hostel allotment is subject to availability. Preferences may vary based on demand.
                  </p>
                </div>

                <div className="form-section">
                  <h3 className="section-title">Hostel Block Preference *</h3>
                  
                  {loadingBlocks ? (
                    <div style={{textAlign: 'center', padding: '2rem', color: '#64748b'}}>
                      Loading hostel blocks...
                    </div>
                  ) : !formData.gender ? (
                    <div style={{textAlign: 'center', padding: '2rem', color: '#64748b'}}>
                      Select your gender in Step 1 to view available hostel blocks.
                    </div>
                  ) : hostelBlocks.length > 0 ? (
                    <div className="radio-group">
                      {hostelBlocks.map((block) => (
                        <label key={block.id} className="radio-label">
                          <input
                            type="radio"
                            name="hostelBlock"
                            value={block.block_name}
                            checked={formData.hostelBlock === block.block_name}
                            onChange={handleInputChange}
                            required
                          />
                          <span className="radio-text">
                            {block.block_name}
                            <small style={{display: 'block', fontSize: '0.85em', color: '#64748b', marginTop: '0.25rem'}}>
                              {block.total_floors} floors - {(block.total_floors || 1) * (block.rooms_per_floor || 0)} rooms
                            </small>
                          </span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div style={{textAlign: 'center', padding: '2rem', color: '#ef4444'}}>
                      No hostel blocks available for your selected gender. Please contact admin.
                    </div>
                  )}
                </div>

                <div className="form-section">
                  <h3 className="section-title">Floor Preference *</h3>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Preferred Floor</label>
                      <select
                        name="floorPreference"
                        className="form-select"
                        value={formData.floorPreference}
                        onChange={handleInputChange}
                        required
                      >
                        <option value="">-- Select Floor --</option>
                        <option value="Ground Floor">Ground Floor</option>
                        <option value="1st Floor">1st Floor</option>
                        <option value="2nd Floor">2nd Floor</option>
                        <option value="3rd Floor">3rd Floor</option>
                        <option value="4th Floor">4th Floor</option>
                        <option value="5th Floor">5th Floor</option>
                      </select>
                    </div>
                  </div>
                  <div className="info-box">
                    <p>
                      💡 Room allocation prioritizes your floor preference. If unavailable, rooms are assigned serially starting from the first available.
                    </p>
                  </div>
                </div>

              </div>
            )}

            {/* STEP 3: FEE PAYMENT DETAILS */}
            {currentStep === 3 && (
              <div className="form-step">
                <div className="step-header">
                  <h2 className="step-title">Fee Payment Details</h2>
                  <p className="step-subtitle">Enter your payment information and upload receipt</p>
                </div>

                <div className="form-section">
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Fee Amount (₹) *</label>
                      <input
                        type="number"
                        name="feeAmount"
                        className="form-input"
                        placeholder="Enter amount in rupees"
                        value={formData.feeAmount}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Payment Mode *</label>
                      <select
                        name="paymentMode"
                        className="form-select"
                        value={formData.paymentMode}
                        onChange={handleInputChange}
                      >
                        <option value="">Select Payment Mode</option>
                        <option value="UPI">UPI</option>
                        <option value="Debit Card">Debit Card</option>
                        <option value="Credit Card">Credit Card</option>
                        <option value="Net Banking">Net Banking</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Transaction ID / UTR Number *</label>
                      <input
                        type="text"
                        name="transactionId"
                        className="form-input"
                        placeholder="Enter transaction ID or UTR"
                        value={formData.transactionId}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Payment Date *</label>
                      <input
                        type="date"
                        name="paymentDate"
                        className="form-input"
                        value={formData.paymentDate}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Fee Receipt Upload (JPG, PNG, PDF – Optional)</label>
                    <div className="file-input-wrapper">
                      <input
                        type="file"
                        id="receiptFile"
                        name="receiptFile"
                        className="file-input"
                        onChange={handleFileChange}
                        accept=".jpg,.jpeg,.png,.pdf"
                        disabled={uploadingFile}
                      />
                      <label htmlFor="receiptFile" className="file-label">
                        {uploadingFile ? '⏳ Uploading...' : (
                          formData.receiptFile ? `✓ ${formData.receiptFile}` : '📎 Click to upload receipt'
                        )}
                      </label>
                    </div>
                    {formData.paymentProofUrl && (
                      <p style={{fontSize: '0.85rem', color: '#10b981', marginTop: '5px'}}>
                        ✓ Receipt uploaded successfully
                      </p>
                    )}
                  </div>
                </div>

                <div className="info-box">
                  <p>
                    💳 Ensure the transaction ID matches your bank statement for faster verification.
                  </p>
                </div>
              </div>
            )}

            {/* STEP 4: REVIEW & CONFIRMATION */}
            {currentStep === 4 && (
              <div className="form-step">
                <div className="step-header">
                  <h2 className="step-title">Review & Confirm</h2>
                  <p className="step-subtitle">Please review your details before submitting</p>
                </div>

                <div className="summary-section">
                  <h3 className="section-title">Personal Information</h3>
                  <div className="summary-card">
                    <div className="summary-grid">
                      <div className="summary-item">
                        <span className="summary-label">FULL NAME:</span>
                        <span className="summary-value">{formData.fullName}</span>
                      </div>
                      <div className="summary-item">
                        <span className="summary-label">EMAIL:</span>
                        <span className="summary-value">{formData.email}</span>
                      </div>
                      <div className="summary-item">
                        <span className="summary-label">PHONE:</span>
                        <span className="summary-value">{formData.phone}</span>
                      </div>
                      <div className="summary-item">
                        <span className="summary-label">ROLL NUMBER:</span>
                        <span className="summary-value">{formData.rollNumber}</span>
                      </div>
                      <div className="summary-item">
                        <span className="summary-label">COLLEGE:</span>
                        <span className="summary-value">
                          {formData.collegeName === 'Other' ? formData.collegeOther : formData.collegeName}
                        </span>
                      </div>
                      <div className="summary-item">
                        <span className="summary-label">BRANCH:</span>
                        <span className="summary-value">{formData.branch}</span>
                      </div>
                      <div className="summary-item">
                        <span className="summary-label">YEAR:</span>
                        <span className="summary-value">{formData.year}</span>
                      </div>
                      <div className="summary-item">
                        <span className="summary-label">GENDER:</span>
                        <span className="summary-value">{formData.gender}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="summary-section">
                  <h3 className="section-title">Parent / Guardian Information</h3>
                  <div className="summary-card">
                    <div className="summary-grid">
                      <div className="summary-item">
                        <span className="summary-label">NAME:</span>
                        <span className="summary-value">{formData.parentName}</span>
                      </div>
                      <div className="summary-item">
                        <span className="summary-label">PHONE:</span>
                        <span className="summary-value">{formData.parentPhone}</span>
                      </div>
                      <div className="summary-item">
                        <span className="summary-label">EMAIL:</span>
                        <span className="summary-value">{formData.parentEmail}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="summary-section">
                  <h3 className="section-title">Hostel Details</h3>
                  <div className="summary-card">
                    <div className="summary-grid">
                      <div className="summary-item">
                        <span className="summary-label">PREFERRED BLOCK:</span>
                        <span className="summary-value">{formData.hostelBlock}</span>
                      </div>
                      <div className="summary-item">
                        <span className="summary-label">PREFERRED FLOOR:</span>
                        <span className="summary-value">{formData.floorPreference}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="summary-section">
                  <h3 className="section-title">Fee Details</h3>
                  <div className="summary-card">
                    <div className="summary-grid">
                      {formData.feeAmount && (
                        <div className="summary-item">
                          <span className="summary-label">FEE AMOUNT:</span>
                          <span className="summary-value">₹{formData.feeAmount}</span>
                        </div>
                      )}
                      {formData.paymentMode && (
                        <div className="summary-item">
                          <span className="summary-label">PAYMENT MODE:</span>
                          <span className="summary-value">{formData.paymentMode}</span>
                        </div>
                      )}
                      {formData.transactionId && (
                        <div className="summary-item">
                          <span className="summary-label">TRANSACTION ID:</span>
                          <span className="summary-value">{formData.transactionId}</span>
                        </div>
                      )}
                      {formData.paymentDate && (
                        <div className="summary-item">
                          <span className="summary-label">PAYMENT DATE:</span>
                          <span className="summary-value">{formData.paymentDate}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="warning-box">
                  <p>
                    ⚠️ Once submitted, you cannot modify your registration until it is reviewed by the warden.
                  </p>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="form-buttons">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleBack}
                style={{ visibility: currentStep === 1 ? 'hidden' : 'visible' }}
              >
                ← Back
              </button>
              {currentStep < 4 ? (
                <button type="button" className="btn btn-primary" onClick={handleNext}>
                  Next →
                </button>
              ) : (
                <button type="submit" className="btn btn-primary btn-submit" disabled={submitting}>
                  {submitting ? '⏳ Submitting...' : '✔ Submit Registration'}
                </button>
              )}
            </div>

            {/* Success Message */}
            {registrationSuccess && (
              <div className="success-message">
                <div className="success-icon">✅</div>
                <h2>Registration Successful!</h2>
                <p>Your registration has been submitted successfully.</p>
                <p>Status: <strong>Pending Verification</strong></p>
                <p>A warden will review your application and notify you soon.</p>
                <p style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
                  Redirecting to dashboard...
                </p>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default StudentRegistration;


