import React from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import '../styles/landing.css';

const LandingPage = () => {
  const navigate = useNavigate();

  const featureCards = [
    {
      title: 'Outpass Automation',
      description: 'Students request digitally while wardens approve in a clean, auditable queue.',
      tag: 'Workflow'
    },
    {
      title: 'Complaint Tracking',
      description: 'From issue raised to resolved, every action stays visible for students and staff.',
      tag: 'Visibility'
    },
    {
      title: 'Leave Management',
      description: 'Plan leave requests with clear approvals, history, and status updates.',
      tag: 'Discipline'
    },
    {
      title: 'Role-Based Dashboards',
      description: 'Admins, wardens, students, security, and technicians each get focused screens.',
      tag: 'Control'
    }
  ];

  const steps = [
    {
      label: 'Step 01',
      title: 'Create Account',
      description: 'Students register once and keep all hostel requests in one secure profile.'
    },
    {
      label: 'Step 02',
      title: 'Submit Requests',
      description: 'Outpass, leave, complaints, and updates flow through one centralized interface.'
    },
    {
      label: 'Step 03',
      title: 'Track Everything',
      description: 'Get instant status updates and transparent actions from every department.'
    }
  ];

  const handleGetStarted = () => {
    navigate('/login');
  };

  const handleRegister = () => {
    navigate('/student-registration');
  };

  return (
    <div className="landing-page">
      <Navbar />

      <section className="hero-section">
        <div className="hero-orb hero-orb-left"></div>
        <div className="hero-orb hero-orb-right"></div>
        <div className="hero-grid">
          <div className="hero-content">
            <div className="hero-badge">Smart Campus Living Platform</div>
            <h1 className="hero-title">
              Run Hostel Operations
              <span className="highlight"> With Clarity</span>
            </h1>
            <p className="hero-subtitle">
              HostelConnect brings students, wardens, security, and staff into one unified system for
              approvals, communication, and day-to-day management.
            </p>

            <div className="hero-buttons">
              <button className="btn btn-primary" onClick={handleGetStarted}>
                Open Portal
              </button>
              <button className="btn btn-secondary" onClick={handleRegister}>
                Student Registration
              </button>
            </div>

            <button
              className="status-cta"
              type="button"
              onClick={() => navigate('/registration-status')}
            >
              Track registration status
            </button>

            <div className="hero-stats">
              <div className="stat-item">
                <div className="stat-number">500+</div>
                <div className="stat-label">Students</div>
              </div>
              <div className="stat-item">
                <div className="stat-number">50+</div>
                <div className="stat-label">Staff</div>
              </div>
              <div className="stat-item">
                <div className="stat-number">24x7</div>
                <div className="stat-label">Coverage</div>
              </div>
            </div>
          </div>

          <div className="hero-panel" aria-hidden="true">
            <div className="panel-head">
              <span className="panel-dot"></span>
              Live Activity
            </div>
            <div className="panel-row">
              <span className="panel-pill panel-pill-success">Outpass Approved</span>
              <span className="panel-time">2 min ago</span>
            </div>
            <div className="panel-row">
              <span className="panel-pill panel-pill-warning">Complaint In Progress</span>
              <span className="panel-time">7 min ago</span>
            </div>
            <div className="panel-row">
              <span className="panel-pill panel-pill-info">Visitor Logged</span>
              <span className="panel-time">12 min ago</span>
            </div>
            <div className="panel-summary">
              <div>
                <strong>98%</strong>
                <span>Request completion rate</span>
              </div>
              <div>
                <strong>4.9/5</strong>
                <span>User satisfaction</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="features-section">
        <div className="features-container">
          <div className="section-header">
            <div className="section-badge">Core Capabilities</div>
            <h2 className="features-title">Built For High-Volume Hostel Teams</h2>
            <p className="features-subtitle">
              Clean workflows, transparent updates, and role-specific tools in one platform.
            </p>
          </div>

          <div className="features-grid">
            {featureCards.map((feature) => (
              <article className="feature-card" key={feature.title}>
                <span className="feature-tag">{feature.tag}</span>
                <h3 className="feature-card-title">{feature.title}</h3>
                <p className="feature-card-description">{feature.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="workflow-section">
        <div className="workflow-container">
          <div className="section-header section-header-dark">
            <div className="section-badge">How It Works</div>
            <h2 className="features-title">Three Steps To Better Operations</h2>
            <p className="features-subtitle">
              Designed for speed, clarity, and accountability from day one.
            </p>
          </div>

          <div className="workflow-grid">
            {steps.map((step) => (
              <article className="workflow-card" key={step.title}>
                <div className="workflow-label">{step.label}</div>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
};

export default LandingPage;
