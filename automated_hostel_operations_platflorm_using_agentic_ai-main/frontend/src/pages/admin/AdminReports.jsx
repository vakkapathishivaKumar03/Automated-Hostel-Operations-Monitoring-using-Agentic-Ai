import React, { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import '../../styles/admin-reports.css';

const AdminReports = () => {
  const [loading, setLoading] = useState(true);
  
  // Analytics data
  const [analyticsData, setAnalyticsData] = useState({
    totalStudents: 0,
    totalRooms: 0,
    occupiedRooms: 0,
    vacantRooms: 0,
    totalComplaints: 0,
    pendingComplaints: 0,
    activeComplaints: 0,
    delayedComplaints: 0,
    resolvedComplaints: 0,
    cancelledComplaints: 0,
    totalOutpasses: 0,
    pendingOutpasses: 0,
    activeOutpasses: 0,
    returnedOutpasses: 0,
    overdueOutpasses: 0,
    rejectedOutpasses: 0,
    totalLeaves: 0,
    pendingLeaves: 0,
    approvedLeaves: 0,
    activeLeaves: 0,
    completedLeaves: 0,
    rejectedLeaves: 0,
    cancelledLeaves: 0,
    expiredLeaves: 0,
    totalRegistrations: 0,
    pendingRegistrations: 0,
    approvedRegistrations: 0,
    rejectedRegistrations: 0,
    feesPaidRegistrations: 0
  });

  // Chart data
  const [roomOccupancyData, setRoomOccupancyData] = useState([]);
  const [complaintsData, setComplaintsData] = useState([]);
  const [outpassData, setOutpassData] = useState([]);
  const [leaveData, setLeaveData] = useState([]);

  // Fetch all reports data
  useEffect(() => {
    fetchReportsData();
  }, []);

  const fetchReportsData = async () => {
    setLoading(true);
    try {
      // Fetch analytics data
      const analyticsRes = await fetch('http://localhost:5000/api/admin/reports/analytics');
      const analyticsJson = await analyticsRes.json();
      if (analyticsJson.success) {
        setAnalyticsData({
          totalStudents: analyticsJson.data.total_students || 0,
          totalRooms: analyticsJson.data.total_rooms || 0,
          occupiedRooms: analyticsJson.data.occupied_rooms || 0,
          vacantRooms: analyticsJson.data.vacant_rooms || 0,
          totalComplaints: analyticsJson.data.total_complaints || 0,
          pendingComplaints: analyticsJson.data.pending_complaints || 0,
          activeComplaints: analyticsJson.data.active_complaints || 0,
          delayedComplaints: analyticsJson.data.delayed_complaints || 0,
          resolvedComplaints: analyticsJson.data.resolved_complaints || 0,
          cancelledComplaints: analyticsJson.data.cancelled_complaints || 0,
          totalOutpasses: analyticsJson.data.total_outpasses || 0,
          pendingOutpasses: analyticsJson.data.pending_outpasses || 0,
          activeOutpasses: analyticsJson.data.active_outpasses || 0,
          returnedOutpasses: analyticsJson.data.returned_outpasses || 0,
          overdueOutpasses: analyticsJson.data.overdue_outpasses || 0,
          rejectedOutpasses: analyticsJson.data.rejected_outpasses || 0,
          totalLeaves: analyticsJson.data.total_leaves || 0,
          pendingLeaves: analyticsJson.data.pending_leaves || 0,
          approvedLeaves: analyticsJson.data.approved_leaves || 0,
          activeLeaves: analyticsJson.data.active_leaves || 0,
          completedLeaves: analyticsJson.data.completed_leaves || 0,
          rejectedLeaves: analyticsJson.data.rejected_leaves || 0,
          cancelledLeaves: analyticsJson.data.cancelled_leaves || 0,
          expiredLeaves: analyticsJson.data.expired_leaves || 0,
          totalRegistrations: analyticsJson.data.total_registrations || 0,
          pendingRegistrations: analyticsJson.data.pending_registrations || 0,
          approvedRegistrations: analyticsJson.data.approved_registrations || 0,
          rejectedRegistrations: analyticsJson.data.rejected_registrations || 0,
          feesPaidRegistrations: analyticsJson.data.fees_paid_registrations || 0
        });
      }

      // Fetch room occupancy trend
      const occupancyRes = await fetch('http://localhost:5000/api/admin/reports/room-occupancy-trend');
      const occupancyJson = await occupancyRes.json();
      if (occupancyJson.success) {
        setRoomOccupancyData(occupancyJson.data);
      }

      // Fetch complaints by category
      const complaintsRes = await fetch('http://localhost:5000/api/admin/reports/complaints-by-category');
      const complaintsJson = await complaintsRes.json();
      if (complaintsJson.success) {
        setComplaintsData(complaintsJson.data);
      }

      // Fetch outpass trend
      const outpassRes = await fetch('http://localhost:5000/api/admin/reports/outpass-trend');
      const outpassJson = await outpassRes.json();
      if (outpassJson.success) {
        setOutpassData(outpassJson.data);
      }

      // Fetch leave trend
      const leaveRes = await fetch('http://localhost:5000/api/admin/reports/leave-trend');
      const leaveJson = await leaveRes.json();
      if (leaveJson.success) {
        setLeaveData(leaveJson.data);
      }
    } catch (error) {
      console.error('Error fetching reports data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Reports list
  const [reports, setReports] = useState([
    {
      id: 1,
      name: 'Complaint Summary Report',
      description: 'Overview of all complaints by category and status',
      lastUpdated: new Date().toISOString().split('T')[0],
      status: 'Ready',
      type: 'complaints'
    },
    {
      id: 2,
      name: 'Outpass Activity Report',
      description: 'Student outpass requests and approvals',
      lastUpdated: new Date().toISOString().split('T')[0],
      status: 'Ready',
      type: 'outpass'
    },
    {
      id: 3,
      name: 'Student Registration Report',
      description: 'New student registrations and demographic data',
      lastUpdated: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'Ready',
      type: 'registration'
    },
    {
      id: 4,
      name: 'Leave Activity Report',
      description: 'Leave requests by status and monthly activity',
      lastUpdated: new Date().toISOString().split('T')[0],
      status: 'Ready',
      type: 'leave'
    },
    {
      id: 5,
      name: 'Hostel Activity Overview',
      description: 'Combined summary of complaints, outpasses, leaves and registrations',
      lastUpdated: new Date().toISOString().split('T')[0],
      status: 'Ready',
      type: 'overview'
    }
  ]);

  // Filter state
  const [dateRange, setDateRange] = useState('last-30-days');
  const [reportType, setReportType] = useState('all');
  const [viewingReport, setViewingReport] = useState(null);
  const [generatingReport, setGeneratingReport] = useState(false);

  const handleGenerateReport = async () => {
    setGeneratingReport(true);

    setTimeout(() => {
      const today = new Date().toISOString().split('T')[0];
      setReports(prev =>
        prev.map(r => ({
          ...r,
          lastUpdated: today,
          status: 'Ready'
        }))
      );
      setGeneratingReport(false);
    }, 1500);
  };

  const handleViewReport = (report) => {
    setViewingReport(report);
  };

  const getReportConfig = (report) => {
    const reportName = (report?.name || '').toLowerCase();
    const reportType = (report?.type || '').toLowerCase();

    if (reportType === 'occupancy' || reportName.includes('occupancy')) {
      const totalRooms = analyticsData.totalRooms || 0;
      const occupiedRooms = analyticsData.occupiedRooms || 0;
      const vacantRooms = analyticsData.vacantRooms || 0;
      const occupancyRate = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;

      return {
        sectionTitle: 'Room Occupancy Data',
        rows: [
          { label: 'Total Rooms', value: totalRooms.toString(), indicator: 'building' },
          { label: 'Occupied Rooms', value: occupiedRooms.toString(), indicator: 'success' },
          { label: 'Vacant Rooms', value: vacantRooms.toString(), indicator: 'warning' },
          { label: 'Occupancy Rate', value: `${occupancyRate.toFixed(2)}%`, indicator: 'rate' }
        ],
        progress: {
          title: 'Occupancy Progress',
          value: occupancyRate,
          display: `${occupancyRate.toFixed(2)}%`,
          color: [37, 99, 235]
        }
      };
    }

    if (reportType === 'complaints' || reportName.includes('complaint')) {
      const totalComplaints = analyticsData.totalComplaints || 0;
      const pendingComplaints = analyticsData.pendingComplaints || 0;
      const activeComplaints = analyticsData.activeComplaints || 0;
      const delayedComplaints = analyticsData.delayedComplaints || 0;
      const resolvedComplaints = analyticsData.resolvedComplaints || 0;
      const cancelledComplaints = analyticsData.cancelledComplaints || 0;
      const resolutionRate = totalComplaints > 0 ? (resolvedComplaints / totalComplaints) * 100 : 0;

      return {
        sectionTitle: 'Complaint Statistics',
        rows: [
          { label: 'Total Complaints', value: totalComplaints.toString(), indicator: 'info' },
          { label: 'Pending', value: pendingComplaints.toString(), indicator: 'warning' },
          { label: 'Active (Assigned / In Progress / Delayed)', value: activeComplaints.toString(), indicator: 'warning' },
          { label: '  — of which Delayed', value: delayedComplaints.toString(), indicator: 'warning' },
          { label: 'Resolved (incl. Closed)', value: resolvedComplaints.toString(), indicator: 'success' },
          { label: 'Cancelled', value: cancelledComplaints.toString(), indicator: 'warning' },
          { label: 'Resolution Rate', value: `${resolutionRate.toFixed(2)}%`, indicator: 'rate' }
        ],
        progress: {
          title: 'Resolution Progress',
          value: resolutionRate,
          display: `${resolutionRate.toFixed(2)}%`,
          color: [22, 163, 74]
        }
      };
    }

    if (reportType === 'outpass' || reportName.includes('outpass')) {
      const totalOutpasses = analyticsData.totalOutpasses || 0;
      const pendingOutpasses = analyticsData.pendingOutpasses || 0;
      const activeOutpasses = analyticsData.activeOutpasses || 0;
      const returnedOutpasses = analyticsData.returnedOutpasses || 0;
      const overdueOutpasses = analyticsData.overdueOutpasses || 0;
      const rejectedOutpasses = analyticsData.rejectedOutpasses || 0;
      const returnRate = totalOutpasses > 0 ? (returnedOutpasses / totalOutpasses) * 100 : 0;

      return {
        sectionTitle: 'Outpass Statistics',
        rows: [
          { label: 'Total Outpasses', value: totalOutpasses.toString(), indicator: 'info' },
          { label: 'Pending Approval', value: pendingOutpasses.toString(), indicator: 'warning' },
          { label: 'Approved & Out', value: activeOutpasses.toString(), indicator: 'success' },
          { label: 'Returned', value: returnedOutpasses.toString(), indicator: 'success' },
          { label: 'Overdue', value: overdueOutpasses.toString(), indicator: 'warning' },
          { label: 'Rejected', value: rejectedOutpasses.toString(), indicator: 'warning' },
          { label: 'Return Rate', value: `${returnRate.toFixed(2)}%`, indicator: 'rate' }
        ],
        progress: {
          title: 'Return Rate',
          value: returnRate,
          display: `${returnRate.toFixed(2)}%`,
          color: [14, 165, 233]
        }
      };
    }

    if (reportType === 'leave' || reportName.includes('leave')) {
      const totalLeaves = analyticsData.totalLeaves || 0;
      const pendingLeaves = analyticsData.pendingLeaves || 0;
      const approvedLeaves = analyticsData.approvedLeaves || 0;
      const activeLeaves = analyticsData.activeLeaves || 0;
      const completedLeaves = analyticsData.completedLeaves || 0;
      const rejectedLeaves = analyticsData.rejectedLeaves || 0;
      const cancelledLeaves = analyticsData.cancelledLeaves || 0;
      const expiredLeaves = analyticsData.expiredLeaves || 0;
      const approvalRate = totalLeaves > 0 ? (approvedLeaves / totalLeaves) * 100 : 0;

      return {
        sectionTitle: 'Leave Activity Statistics',
        rows: [
          { label: 'Total Leave Requests', value: totalLeaves.toString(), indicator: 'info' },
          { label: 'Pending', value: pendingLeaves.toString(), indicator: 'warning' },
          { label: 'Approved (incl. Active & Completed)', value: approvedLeaves.toString(), indicator: 'success' },
          { label: '  — Currently Active', value: activeLeaves.toString(), indicator: 'success' },
          { label: '  — Completed', value: completedLeaves.toString(), indicator: 'success' },
          { label: 'Rejected', value: rejectedLeaves.toString(), indicator: 'warning' },
          { label: 'Cancelled', value: cancelledLeaves.toString(), indicator: 'warning' },
          { label: 'Expired', value: expiredLeaves.toString(), indicator: 'warning' },
          { label: 'Approval Rate', value: `${approvalRate.toFixed(2)}%`, indicator: 'rate' }
        ],
        progress: {
          title: 'Leave Approval Progress',
          value: approvalRate,
          display: `${approvalRate.toFixed(2)}%`,
          color: [14, 165, 233]
        }
      };
    }

    if (reportType === 'registration' || reportName.includes('registration')) {
      const totalRegistrations = analyticsData.totalRegistrations || 0;
      const pendingRegistrations = analyticsData.pendingRegistrations || 0;
      const approvedRegistrations = analyticsData.approvedRegistrations || 0;
      const rejectedRegistrations = analyticsData.rejectedRegistrations || 0;
      const feesPaidRegistrations = analyticsData.feesPaidRegistrations || 0;
      const feesPendingInApproved = Math.max(0, approvedRegistrations - feesPaidRegistrations);
      const approvalRate = totalRegistrations > 0 ? (approvedRegistrations / totalRegistrations) * 100 : 0;

      return {
        sectionTitle: 'Student Registration Statistics',
        rows: [
          { label: 'Total Registered', value: totalRegistrations.toString(), indicator: 'info' },
          { label: 'Accepted', value: approvedRegistrations.toString(), indicator: 'success' },
          { label: 'Rejected', value: rejectedRegistrations.toString(), indicator: 'warning' },
          { label: 'Pending Review', value: pendingRegistrations.toString(), indicator: 'warning' },
          { label: 'Fees Paid (of Accepted)', value: feesPaidRegistrations.toString(), indicator: 'success' },
          { label: 'Fees Pending (of Accepted)', value: feesPendingInApproved.toString(), indicator: 'warning' },
          { label: 'Acceptance Rate', value: `${approvalRate.toFixed(2)}%`, indicator: 'rate' }
        ],
        progress: {
          title: 'Acceptance Rate',
          value: approvalRate,
          display: `${approvalRate.toFixed(2)}%`,
          color: [22, 163, 74]
        }
      };
    }

    const totalStudents = analyticsData.totalStudents || 0;
    const totalRooms = analyticsData.totalRooms || 0;
    const occupancyRate = totalRooms > 0 ? ((analyticsData.occupiedRooms || 0) / totalRooms) * 100 : 0;

    if (reportType === 'overview' || reportName.includes('overview')) {
      const totalComplaints = analyticsData.totalComplaints || 0;
      const resolvedComplaints = analyticsData.resolvedComplaints || 0;
      const totalOutpasses = analyticsData.totalOutpasses || 0;
      const returnedOutpasses = analyticsData.returnedOutpasses || 0;
      const totalLeaves = analyticsData.totalLeaves || 0;
      const approvedLeaves = analyticsData.approvedLeaves || 0;
      const totalRegistrations = analyticsData.totalRegistrations || 0;
      const approvedRegistrations = analyticsData.approvedRegistrations || 0;
      const feesPaidRegistrations = analyticsData.feesPaidRegistrations || 0;
      const complaintResolutionRate = totalComplaints > 0 ? (resolvedComplaints / totalComplaints) * 100 : 0;
      const outpassReturnRate = totalOutpasses > 0 ? (returnedOutpasses / totalOutpasses) * 100 : 0;
      const leaveApprovalRate = totalLeaves > 0 ? (approvedLeaves / totalLeaves) * 100 : 0;
      const regAcceptanceRate = totalRegistrations > 0 ? (approvedRegistrations / totalRegistrations) * 100 : 0;
      return {
        sectionTitle: 'Hostel Activity Overview',
        rows: [
          { label: '[ STUDENTS ]', value: '', indicator: 'info' },
          { label: 'Total Students', value: totalStudents.toString(), indicator: 'info' },
          { label: 'Total Rooms', value: totalRooms.toString(), indicator: 'building' },
          { label: 'Occupied Rooms', value: (analyticsData.occupiedRooms || 0).toString(), indicator: 'success' },
          { label: 'Vacant Rooms', value: (analyticsData.vacantRooms || 0).toString(), indicator: 'warning' },
          { label: 'Room Occupancy Rate', value: `${occupancyRate.toFixed(2)}%`, indicator: 'rate' },
          { label: '[ COMPLAINTS ]', value: '', indicator: 'info' },
          { label: 'Total Complaints', value: totalComplaints.toString(), indicator: 'info' },
          { label: 'Pending', value: (analyticsData.pendingComplaints || 0).toString(), indicator: 'warning' },
          { label: 'Active (Assigned/In Progress/Delayed)', value: (analyticsData.activeComplaints || 0).toString(), indicator: 'warning' },
          { label: '  — of which Delayed', value: (analyticsData.delayedComplaints || 0).toString(), indicator: 'warning' },
          { label: 'Resolved (incl. Closed)', value: resolvedComplaints.toString(), indicator: 'success' },
          { label: 'Cancelled', value: (analyticsData.cancelledComplaints || 0).toString(), indicator: 'warning' },
          { label: 'Resolution Rate', value: `${complaintResolutionRate.toFixed(2)}%`, indicator: 'rate' },
          { label: '[ OUTPASSES ]', value: '', indicator: 'info' },
          { label: 'Total Outpasses', value: totalOutpasses.toString(), indicator: 'info' },
          { label: 'Pending Approval', value: (analyticsData.pendingOutpasses || 0).toString(), indicator: 'warning' },
          { label: 'Approved & Out', value: (analyticsData.activeOutpasses || 0).toString(), indicator: 'success' },
          { label: 'Returned', value: returnedOutpasses.toString(), indicator: 'success' },
          { label: 'Overdue', value: (analyticsData.overdueOutpasses || 0).toString(), indicator: 'warning' },
          { label: 'Rejected', value: (analyticsData.rejectedOutpasses || 0).toString(), indicator: 'warning' },
          { label: 'Return Rate', value: `${outpassReturnRate.toFixed(2)}%`, indicator: 'rate' },
          { label: '[ LEAVES ]', value: '', indicator: 'info' },
          { label: 'Total Leave Requests', value: totalLeaves.toString(), indicator: 'info' },
          { label: 'Pending', value: (analyticsData.pendingLeaves || 0).toString(), indicator: 'warning' },
          { label: 'Approved (incl. Active & Completed)', value: approvedLeaves.toString(), indicator: 'success' },
          { label: '  — Currently Active', value: (analyticsData.activeLeaves || 0).toString(), indicator: 'success' },
          { label: '  — Completed', value: (analyticsData.completedLeaves || 0).toString(), indicator: 'success' },
          { label: 'Rejected', value: (analyticsData.rejectedLeaves || 0).toString(), indicator: 'warning' },
          { label: 'Cancelled', value: (analyticsData.cancelledLeaves || 0).toString(), indicator: 'warning' },
          { label: 'Expired', value: (analyticsData.expiredLeaves || 0).toString(), indicator: 'warning' },
          { label: 'Approval Rate', value: `${leaveApprovalRate.toFixed(2)}%`, indicator: 'rate' },
          { label: '[ REGISTRATIONS ]', value: '', indicator: 'info' },
          { label: 'Total Registered', value: totalRegistrations.toString(), indicator: 'info' },
          { label: 'Accepted', value: approvedRegistrations.toString(), indicator: 'success' },
          { label: 'Rejected', value: (analyticsData.rejectedRegistrations || 0).toString(), indicator: 'warning' },
          { label: 'Pending Review', value: (analyticsData.pendingRegistrations || 0).toString(), indicator: 'warning' },
          { label: 'Fees Paid (of Accepted)', value: feesPaidRegistrations.toString(), indicator: 'success' },
          { label: 'Fees Pending (of Accepted)', value: Math.max(0, approvedRegistrations - feesPaidRegistrations).toString(), indicator: 'warning' },
          { label: 'Acceptance Rate', value: `${regAcceptanceRate.toFixed(2)}%`, indicator: 'rate' },
        ],
        progress: {
          title: 'Room Occupancy Rate',
          value: occupancyRate,
          display: `${occupancyRate.toFixed(2)}%`,
          color: [99, 102, 241]
        }
      };
    }

    return {
      sectionTitle: 'General Statistics',
      rows: [
        { label: 'Total Students', value: totalStudents.toString(), indicator: 'info' },
        { label: 'Total Rooms', value: totalRooms.toString(), indicator: 'building' },
        { label: 'Total Complaints', value: (analyticsData.totalComplaints || 0).toString(), indicator: 'warning' },
        { label: 'Total Outpasses', value: (analyticsData.totalOutpasses || 0).toString(), indicator: 'rate' }
      ],
      progress: {
        title: 'Occupancy Overview',
        value: occupancyRate,
        display: `${occupancyRate.toFixed(2)}%`,
        color: [99, 102, 241]
      }
    };
  };

  const handleDownloadReport = (report) => {
    const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const marginX = 36;
    const contentWidth = pageWidth - marginX * 2;
    const generatedAt = new Date().toLocaleString();

    const safeFileName = (report?.name || 'Report').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '');

    // ─── Helper: draw footer on current page ───────────────────────────────────
    const drawFooter = (pageNum) => {
      const fy = pageHeight - 40;
      pdf.setDrawColor(203, 213, 225);
      pdf.setLineWidth(0.5);
      pdf.line(marginX, fy, pageWidth - marginX, fy);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(107, 114, 128);
      pdf.text('Generated by HostelConnect - Automated Hostel Operations Platform', pageWidth / 2, fy + 13, { align: 'center' });
      pdf.text(`Page ${pageNum}`, pageWidth / 2, fy + 25, { align: 'center' });
    };

    // ─── Helper: draw page header band ─────────────────────────────────────────
    const drawPageHeader = () => {
      // Deep indigo header band
      pdf.setFillColor(67, 56, 202);
      pdf.rect(0, 0, pageWidth, 76, 'F');

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(24);
      pdf.setTextColor(255, 255, 255);
      pdf.text(report?.name || 'Hostel Activity Overview', marginX, 34);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(11);
      pdf.setTextColor(199, 210, 254);
      pdf.text('Hostel Management System', marginX, 54);

      pdf.setFontSize(9);
      pdf.setTextColor(199, 210, 254);
      pdf.text(`Generated: ${generatedAt}`, pageWidth - marginX, 54, { align: 'right' });

      // Thin accent line below header
      pdf.setFillColor(129, 140, 248);
      pdf.rect(0, 76, pageWidth, 3, 'F');
    };

    // ─── VALUE COLOR ─────────────────────────────────────────────────────────────
    const valueColor = (indicator) => {
      if (indicator === 'success') return [22, 163, 74];
      if (indicator === 'warning') return [234, 88, 12];
      if (indicator === 'danger')  return [220, 38, 38];
      if (indicator === 'rate')    return [67, 56, 202];
      return [30, 41, 59];
    };

    // ─── SHARED CARD DRAWING ─────────────────────────────────────────────────────
    const CARD_PAD_X = 14;
    const CARD_PAD_TOP = 28;
    const METRIC_H = 36;
    const TITLE_BAND_H = 32;

    const drawSectionCard = (cx, cy, cw, title, accentColor, metrics) => {
      const ch = TITLE_BAND_H + CARD_PAD_TOP + metrics.length * METRIC_H + 14;
      pdf.setFillColor(226, 232, 240);
      pdf.roundedRect(cx + 3, cy + 3, cw, ch, 8, 8, 'F');
      pdf.setFillColor(255, 255, 255);
      pdf.setDrawColor(226, 232, 240);
      pdf.setLineWidth(0.8);
      pdf.roundedRect(cx, cy, cw, ch, 8, 8, 'FD');
      pdf.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
      pdf.roundedRect(cx, cy, cw, TITLE_BAND_H, 8, 8, 'F');
      pdf.rect(cx, cy + TITLE_BAND_H - 8, cw, 8, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(13);
      pdf.setTextColor(255, 255, 255);
      pdf.text(title, cx + CARD_PAD_X, cy + TITLE_BAND_H - 9);
      let my = cy + TITLE_BAND_H + CARD_PAD_TOP - 8;
      metrics.forEach((m, idx) => {
        const isLast = idx === metrics.length - 1;
        const indent = m.sub ? CARD_PAD_X + 14 : CARD_PAD_X;
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(m.sub ? 9 : 10);
        pdf.setTextColor(m.sub ? 107 : 75, m.sub ? 114 : 85, m.sub ? 128 : 99);
        pdf.text(m.label, cx + indent, my);
        const vc = valueColor(m.indicator);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(m.sub ? 11 : 16);
        pdf.setTextColor(vc[0], vc[1], vc[2]);
        pdf.text(m.value, cx + cw - CARD_PAD_X, my + (m.sub ? 0 : 2), { align: 'right' });
        if (!isLast) {
          pdf.setDrawColor(241, 245, 249);
          pdf.setLineWidth(0.5);
          pdf.line(cx + CARD_PAD_X, my + 10, cx + cw - CARD_PAD_X, my + 10);
        }
        my += METRIC_H;
      });
      return ch;
    };

    // ─── RATE BANNER HELPER ───────────────────────────────────────────────────────
    const drawRateBanner = (y, accentColor, label, sub, rate, rateStr) => {
      const bh = 56;
      const rateColor = rate >= 80 ? [22, 163, 74] : rate >= 50 ? [234, 88, 12] : [220, 38, 38];
      pdf.setFillColor(248, 250, 252);
      pdf.setDrawColor(accentColor[0], accentColor[1], accentColor[2]);
      pdf.setLineWidth(1);
      pdf.roundedRect(marginX, y, contentWidth, bh, 8, 8, 'FD');
      pdf.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
      pdf.roundedRect(marginX, y, 5, bh, 3, 3, 'F');
      pdf.rect(marginX + 2, y, 3, bh, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
      pdf.text(label, marginX + 20, y + 20);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(107, 114, 128);
      pdf.text(sub, marginX + 20, y + 34);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(28);
      pdf.setTextColor(rateColor[0], rateColor[1], rateColor[2]);
      pdf.text(rateStr, pageWidth - marginX - 14, y + 38, { align: 'right' });
      const pbW = contentWidth * 0.56;
      const pbFill = Math.max(0, Math.min(pbW, (rate / 100) * pbW));
      pdf.setFillColor(226, 232, 240);
      pdf.roundedRect(marginX + 20, y + 44, pbW, 6, 3, 3, 'F');
      pdf.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
      pdf.roundedRect(marginX + 20, y + 44, pbFill, 6, 3, 3, 'F');
      return bh;
    };

    // ─── OVERVIEW DASHBOARD PDF ──────────────────────────────────────────────────
    if (report.type === 'overview' || (report.name && report.name.toLowerCase().includes('overview'))) {
      const ad = analyticsData;
      const totalStudents = ad.totalStudents || 0;
      const totalRooms = ad.totalRooms || 0;
      const occupiedRooms = ad.occupiedRooms || 0;
      const vacantRooms = ad.vacantRooms || 0;
      const occupancyRate = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;

      const totalComplaints   = ad.totalComplaints || 0;
      const pendingComplaints = ad.pendingComplaints || 0;
      const activeComplaints  = ad.activeComplaints || 0;
      const delayedComplaints = ad.delayedComplaints || 0;
      const resolvedComplaints= ad.resolvedComplaints || 0;
      const cancelledComplaints = ad.cancelledComplaints || 0;
      const complaintResRate  = totalComplaints > 0 ? (resolvedComplaints / totalComplaints) * 100 : 0;

      const totalOutpasses    = ad.totalOutpasses || 0;
      const pendingOutpasses  = ad.pendingOutpasses || 0;
      const activeOutpasses   = ad.activeOutpasses || 0;
      const returnedOutpasses = ad.returnedOutpasses || 0;
      const overdueOutpasses  = ad.overdueOutpasses || 0;
      const rejectedOutpasses = ad.rejectedOutpasses || 0;
      const outpassReturnRate = totalOutpasses > 0 ? (returnedOutpasses / totalOutpasses) * 100 : 0;

      const totalLeaves       = ad.totalLeaves || 0;
      const pendingLeaves     = ad.pendingLeaves || 0;
      const approvedLeaves    = ad.approvedLeaves || 0;
      const activeLeaves      = ad.activeLeaves || 0;
      const completedLeaves   = ad.completedLeaves || 0;
      const rejectedLeaves    = ad.rejectedLeaves || 0;
      const cancelledLeaves   = ad.cancelledLeaves || 0;
      const expiredLeaves     = ad.expiredLeaves || 0;
      const leaveApprovalRate = totalLeaves > 0 ? (approvedLeaves / totalLeaves) * 100 : 0;

      const totalRegs         = ad.totalRegistrations || 0;
      const approvedRegs      = ad.approvedRegistrations || 0;
      const rejectedRegs      = ad.rejectedRegistrations || 0;
      const pendingRegs       = ad.pendingRegistrations || 0;
      const feesPaidRegs      = ad.feesPaidRegistrations || 0;
      const feesPendingRegs   = Math.max(0, approvedRegs - feesPaidRegs);
      const regAcceptRate     = totalRegs > 0 ? (approvedRegs / totalRegs) * 100 : 0;

      // ─── PAGE 1 ────────────────────────────────────────────────────────────────
      drawPageHeader();
      let curY = 100;
      curY += drawRateBanner(curY, [67, 56, 202], 'Room Occupancy Rate', `${occupiedRooms} of ${totalRooms} rooms occupied`, occupancyRate, `${occupancyRate.toFixed(1)}%`) + 16;

      // ── Two-column grid ────────────────────────────────────────────────────────
      const COL_GAP = 14;
      const colW = (contentWidth - COL_GAP) / 2;

      // Row 1: Students | Complaints
      const studMetrics = [
        { label: 'Total Students',  value: totalStudents.toString(), indicator: 'info' },
        { label: 'Total Rooms',     value: totalRooms.toString(),    indicator: 'info' },
        { label: 'Occupied Rooms',  value: occupiedRooms.toString(), indicator: 'success' },
        { label: 'Vacant Rooms',    value: vacantRooms.toString(),   indicator: 'warning' },
      ];
      const complMetrics = [
        { label: 'Total Complaints',              value: totalComplaints.toString(),    indicator: 'info' },
        { label: 'Pending',                        value: pendingComplaints.toString(),  indicator: 'warning' },
        { label: 'Active (Assigned/In Progress)',  value: activeComplaints.toString(),   indicator: 'warning' },
        { label: '— of which Delayed',            value: delayedComplaints.toString(),  indicator: 'danger', sub: true },
        { label: 'Resolved (incl. Closed)',        value: resolvedComplaints.toString(), indicator: 'success' },
        { label: 'Cancelled',                      value: cancelledComplaints.toString(),indicator: 'warning' },
        { label: 'Resolution Rate',                value: `${complaintResRate.toFixed(1)}%`, indicator: 'rate' },
      ];

      const h1L = drawSectionCard(marginX,          curY, colW, 'Students',   [67, 56, 202],  studMetrics);
      const h1R = drawSectionCard(marginX + colW + COL_GAP, curY, colW, 'Complaints', [220, 38, 38],  complMetrics);
      curY += Math.max(h1L, h1R) + 16;

      // Row 2: Outpasses | Leaves
      const outpassMetrics = [
        { label: 'Total Outpasses',    value: totalOutpasses.toString(),    indicator: 'info' },
        { label: 'Pending Approval',   value: pendingOutpasses.toString(),  indicator: 'warning' },
        { label: 'Approved & Out',     value: activeOutpasses.toString(),   indicator: 'success' },
        { label: 'Returned',           value: returnedOutpasses.toString(), indicator: 'success' },
        { label: 'Overdue',            value: overdueOutpasses.toString(),  indicator: 'danger' },
        { label: 'Rejected',           value: rejectedOutpasses.toString(), indicator: 'danger' },
        { label: 'Return Rate',        value: `${outpassReturnRate.toFixed(1)}%`, indicator: 'rate' },
      ];
      const leaveMetrics = [
        { label: 'Total Leave Requests',           value: totalLeaves.toString(),    indicator: 'info' },
        { label: 'Pending',                         value: pendingLeaves.toString(),  indicator: 'warning' },
        { label: 'Approved (incl. Active+Done)',    value: approvedLeaves.toString(), indicator: 'success' },
        { label: '— Currently Active',             value: activeLeaves.toString(),   indicator: 'success', sub: true },
        { label: '— Completed',                    value: completedLeaves.toString(),indicator: 'success', sub: true },
        { label: 'Rejected',                        value: rejectedLeaves.toString(), indicator: 'danger' },
        { label: 'Cancelled',                       value: cancelledLeaves.toString(),indicator: 'warning' },
        { label: 'Expired',                         value: expiredLeaves.toString(),  indicator: 'danger' },
        { label: 'Approval Rate',                   value: `${leaveApprovalRate.toFixed(1)}%`, indicator: 'rate' },
      ];

      // Check if we need a new page for row 2
      const estH2 = TITLE_BAND_H + CARD_PAD_TOP + Math.max(outpassMetrics.length, leaveMetrics.length) * METRIC_H + 30;
      if (curY + estH2 > pageHeight - 70) {
        drawFooter(1);
        pdf.addPage();
        drawPageHeader();
        curY = 100;
      }

      const h2L = drawSectionCard(marginX,          curY, colW, 'Outpasses', [234, 88, 12], outpassMetrics);
      const h2R = drawSectionCard(marginX + colW + COL_GAP, curY, colW, 'Leaves',    [16, 185, 129], leaveMetrics);
      curY += Math.max(h2L, h2R) + 16;

      // Row 3: Registrations (full width)
      const regMetrics = [
        { label: 'Total Registered',       value: totalRegs.toString(),       indicator: 'info' },
        { label: 'Accepted',               value: approvedRegs.toString(),    indicator: 'success' },
        { label: 'Rejected',               value: rejectedRegs.toString(),    indicator: 'danger' },
        { label: 'Pending Review',         value: pendingRegs.toString(),     indicator: 'warning' },
        { label: 'Fees Paid (of Accepted)',value: feesPaidRegs.toString(),    indicator: 'success' },
        { label: 'Fees Pending (of Accepted)', value: feesPendingRegs.toString(), indicator: 'warning' },
        { label: 'Acceptance Rate',        value: `${regAcceptRate.toFixed(1)}%`, indicator: 'rate' },
      ];

      const estH3 = TITLE_BAND_H + CARD_PAD_TOP + regMetrics.length * METRIC_H + 30;
      if (curY + estH3 > pageHeight - 70) {
        drawFooter(1);
        pdf.addPage();
        drawPageHeader();
        curY = 100;
      }

      drawSectionCard(marginX, curY, contentWidth, 'Registrations', [14, 116, 144], regMetrics);
      curY += estH3;

      // Footer on last page
      const totalPages = pdf.internal.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        pdf.setPage(p);
        drawFooter(p);
      }

      pdf.save(`${safeFileName || 'Hostel_Activity_Overview'}_${new Date().getTime()}.pdf`);
      return;
    }

    // ─── STANDARD single-report dashboard PDF ────────────────────────────────────
    const ad = analyticsData;
    let accentColor, bannerLabel, bannerSub, bannerRate, bannerRateStr, sectionTitle, stdMetrics;

    if (report.type === 'complaints' || (report.name && report.name.toLowerCase().includes('complaint'))) {
      accentColor = [220, 38, 38];
      sectionTitle = 'Complaint Statistics';
      const total = ad.totalComplaints || 0;
      const resolved = ad.resolvedComplaints || 0;
      bannerRate = total > 0 ? (resolved / total) * 100 : 0;
      bannerLabel = 'Resolution Rate';
      bannerSub = `${resolved} of ${total} complaints resolved`;
      bannerRateStr = `${bannerRate.toFixed(1)}%`;
      stdMetrics = [
        { label: 'Total Complaints',                value: total.toString(),                       indicator: 'info' },
        { label: 'Pending',                          value: (ad.pendingComplaints||0).toString(),   indicator: 'warning' },
        { label: 'Active (Assigned / In Progress)', value: (ad.activeComplaints||0).toString(),    indicator: 'warning' },
        { label: '— of which Delayed',              value: (ad.delayedComplaints||0).toString(),   indicator: 'danger', sub: true },
        { label: 'Resolved (incl. Closed)',          value: resolved.toString(),                    indicator: 'success' },
        { label: 'Cancelled',                        value: (ad.cancelledComplaints||0).toString(), indicator: 'warning' },
        { label: 'Resolution Rate',                  value: bannerRateStr,                          indicator: 'rate' },
      ];
    } else if (report.type === 'outpass' || (report.name && report.name.toLowerCase().includes('outpass'))) {
      accentColor = [234, 88, 12];
      sectionTitle = 'Outpass Statistics';
      const total = ad.totalOutpasses || 0;
      const returned = ad.returnedOutpasses || 0;
      bannerRate = total > 0 ? (returned / total) * 100 : 0;
      bannerLabel = 'Return Rate';
      bannerSub = `${returned} of ${total} outpasses returned`;
      bannerRateStr = `${bannerRate.toFixed(1)}%`;
      stdMetrics = [
        { label: 'Total Outpasses',    value: total.toString(),                      indicator: 'info' },
        { label: 'Pending Approval',   value: (ad.pendingOutpasses||0).toString(),   indicator: 'warning' },
        { label: 'Approved & Out',     value: (ad.activeOutpasses||0).toString(),    indicator: 'success' },
        { label: 'Returned',           value: returned.toString(),                   indicator: 'success' },
        { label: 'Overdue',            value: (ad.overdueOutpasses||0).toString(),   indicator: 'danger' },
        { label: 'Rejected',           value: (ad.rejectedOutpasses||0).toString(),  indicator: 'danger' },
        { label: 'Return Rate',        value: bannerRateStr,                         indicator: 'rate' },
      ];
    } else if (report.type === 'leave' || (report.name && report.name.toLowerCase().includes('leave'))) {
      accentColor = [16, 185, 129];
      sectionTitle = 'Leave Activity Statistics';
      const total = ad.totalLeaves || 0;
      const approved = ad.approvedLeaves || 0;
      bannerRate = total > 0 ? (approved / total) * 100 : 0;
      bannerLabel = 'Approval Rate';
      bannerSub = `${approved} of ${total} leave requests approved`;
      bannerRateStr = `${bannerRate.toFixed(1)}%`;
      stdMetrics = [
        { label: 'Total Leave Requests',              value: total.toString(),                       indicator: 'info' },
        { label: 'Pending',                            value: (ad.pendingLeaves||0).toString(),       indicator: 'warning' },
        { label: 'Approved (incl. Active+Completed)', value: approved.toString(),                    indicator: 'success' },
        { label: '— Currently Active',                value: (ad.activeLeaves||0).toString(),        indicator: 'success', sub: true },
        { label: '— Completed',                       value: (ad.completedLeaves||0).toString(),     indicator: 'success', sub: true },
        { label: 'Rejected',                           value: (ad.rejectedLeaves||0).toString(),      indicator: 'danger' },
        { label: 'Cancelled',                          value: (ad.cancelledLeaves||0).toString(),     indicator: 'warning' },
        { label: 'Expired',                            value: (ad.expiredLeaves||0).toString(),       indicator: 'danger' },
        { label: 'Approval Rate',                      value: bannerRateStr,                          indicator: 'rate' },
      ];
    } else if (report.type === 'registration' || (report.name && report.name.toLowerCase().includes('registration'))) {
      accentColor = [14, 116, 144];
      sectionTitle = 'Student Registration Statistics';
      const total = ad.totalRegistrations || 0;
      const approved = ad.approvedRegistrations || 0;
      const feesPaid = ad.feesPaidRegistrations || 0;
      bannerRate = total > 0 ? (approved / total) * 100 : 0;
      bannerLabel = 'Acceptance Rate';
      bannerSub = `${approved} of ${total} registrations accepted`;
      bannerRateStr = `${bannerRate.toFixed(1)}%`;
      stdMetrics = [
        { label: 'Total Registered',           value: total.toString(),                            indicator: 'info' },
        { label: 'Accepted',                    value: approved.toString(),                         indicator: 'success' },
        { label: 'Rejected',                    value: (ad.rejectedRegistrations||0).toString(),    indicator: 'danger' },
        { label: 'Pending Review',              value: (ad.pendingRegistrations||0).toString(),     indicator: 'warning' },
        { label: 'Fees Paid (of Accepted)',     value: feesPaid.toString(),                         indicator: 'success' },
        { label: 'Fees Pending (of Accepted)',  value: Math.max(0, approved - feesPaid).toString(), indicator: 'warning' },
        { label: 'Acceptance Rate',             value: bannerRateStr,                               indicator: 'rate' },
      ];
    } else {
      // occupancy / fallback
      accentColor = [67, 56, 202];
      sectionTitle = 'Room Occupancy Data';
      const totalRooms = ad.totalRooms || 0;
      const occupiedRooms = ad.occupiedRooms || 0;
      bannerRate = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;
      bannerLabel = 'Occupancy Rate';
      bannerSub = `${occupiedRooms} of ${totalRooms} rooms occupied`;
      bannerRateStr = `${bannerRate.toFixed(1)}%`;
      stdMetrics = [
        { label: 'Total Rooms',    value: totalRooms.toString(),           indicator: 'info' },
        { label: 'Occupied Rooms', value: occupiedRooms.toString(),        indicator: 'success' },
        { label: 'Vacant Rooms',   value: (ad.vacantRooms||0).toString(),  indicator: 'warning' },
        { label: 'Occupancy Rate', value: bannerRateStr,                   indicator: 'rate' },
      ];
    }

    drawPageHeader();
    let stdY = 100;
    stdY += drawRateBanner(stdY, accentColor, bannerLabel, bannerSub, bannerRate, bannerRateStr) + 16;
    drawSectionCard(marginX, stdY, contentWidth, sectionTitle, accentColor, stdMetrics);
    drawFooter(1);
    pdf.save(`${safeFileName || 'report'}_${new Date().getTime()}.pdf`);
  };

  return (
    <div className="admin-reports-page">
      {/* Page Header */}
      <div className="page-header page-header-card">
        <div className="header-content page-header-text">
          <h1 className="page-title">Reports & Analytics</h1>
          <p className="page-subtitle">Overview of hostel operations and activity</p>
        </div>
        <div className="page-header-action">
          <button 
            className="refresh-btn"
            onClick={fetchReportsData}
            disabled={loading}
            style={{
              padding: '10px 20px',
              backgroundColor: '#6366f1',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1
            }}
          >
            {loading ? '🔄 Loading...' : '🔄 Refresh Data'}
          </button>
        </div>
      </div>

      {/* Filters Section */}
      <div className="filters-section">
        <div className="filter-group">
          <label>Date Range</label>
          <select 
            className="filter-select"
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
          >
            <option value="last-7-days">Last 7 Days</option>
            <option value="last-30-days">Last 30 Days</option>
            <option value="last-3-months">Last 3 Months</option>
            <option value="last-6-months">Last 6 Months</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Report Type</label>
          <select 
            className="filter-select"
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
          >
            <option value="all">All Reports</option>
            <option value="complaints">Complaints</option>
            <option value="outpass">Outpass</option>
            <option value="leave">Leave</option>
            <option value="overview">Overview</option>
          </select>
        </div>
      </div>

      {/* Analytics Summary Cards */}
      <div className="analytics-cards">
        <div className="analytics-card card-blue">
          <div className="card-icon">👥</div>
          <div className="card-content">
            <div className="card-value">{analyticsData.totalStudents}</div>
            <div className="card-label">Total Students</div>
          </div>
        </div>

        <div className="analytics-card card-purple">
          <div className="card-icon">🏠</div>
          <div className="card-content">
            <div className="card-value">{analyticsData.totalRooms}</div>
            <div className="card-label">Total Rooms</div>
          </div>
        </div>

        <div className="analytics-card card-green">
          <div className="card-icon">✅</div>
          <div className="card-content">
            <div className="card-value">{analyticsData.occupiedRooms}</div>
            <div className="card-label">Occupied Rooms</div>
          </div>
        </div>

        <div className="analytics-card card-orange">
          <div className="card-icon">🔓</div>
          <div className="card-content">
            <div className="card-value">{analyticsData.vacantRooms}</div>
            <div className="card-label">Vacant Rooms</div>
          </div>
        </div>

        <div className="analytics-card card-red">
          <div className="card-icon">📋</div>
          <div className="card-content">
            <div className="card-value">{analyticsData.totalComplaints}</div>
            <div className="card-label">Total Complaints</div>
          </div>
        </div>

        <div className="analytics-card card-yellow">
          <div className="card-icon">⏳</div>
          <div className="card-content">
            <div className="card-value">{analyticsData.pendingComplaints}</div>
            <div className="card-label">Pending Complaints</div>
          </div>
        </div>

        <div className="analytics-card card-cyan">
          <div className="card-icon">🎫</div>
          <div className="card-content">
            <div className="card-value">{analyticsData.totalOutpasses}</div>
            <div className="card-label">Total Outpasses</div>
          </div>
        </div>

        <div className="analytics-card card-pink">
          <div className="card-icon">🔄</div>
          <div className="card-content">
            <div className="card-value">{analyticsData.activeOutpasses}</div>
            <div className="card-label">Active Outpasses</div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="charts-section">
        {/* Room Occupancy Chart */}
        <div className="chart-container">
          <div className="chart-header">
            <h3>Room Occupancy Trend</h3>
            <span className="chart-subtitle">Year-wise</span>
          </div>
          <div className="chart-body">
            <div className="bar-chart">
              {roomOccupancyData.map((item, index) => (
                <div key={index} className="bar-item">
                  <div className="bar-wrapper">
                    <div 
                      className="bar"
                      style={{ height: `${item.occupancy}%` }}
                      title={`${item.year || item.month}: ${item.occupancy}%`}
                    >
                      <span className="bar-value">{item.occupancy}%</span>
                    </div>
                  </div>
                  <div className="bar-label">{item.year || item.month}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Complaints by Category Chart */}
        <div className="chart-container">
          <div className="chart-header">
            <h3>Complaints by Category</h3>
            <span className="chart-subtitle">Current Month</span>
          </div>
          <div className="chart-body">
            <div className="pie-chart-wrapper">
              <div className="pie-chart">
                {complaintsData.map((item, index) => (
                  <div 
                    key={index}
                    className="pie-segment"
                    style={{ 
                      '--segment-color': item.color,
                      '--segment-percent': `${(item.count / Math.max(1, complaintsData.reduce((sum, current) => sum + (current.count || 0), 0))) * 100}%`
                    }}
                  ></div>
                ))}
              </div>
              <div className="pie-legend">
                {complaintsData.map((item, index) => (
                  <div key={index} className="legend-item">
                    <span 
                      className="legend-color" 
                      style={{ backgroundColor: item.color }}
                    ></span>
                    <span className="legend-label">{item.category}</span>
                    <span className="legend-value">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Outpass Requests Chart */}
        <div className="chart-container">
          <div className="chart-header">
            <h3>Outpass Requests by Month</h3>
            <span className="chart-subtitle">Last 6 Months</span>
          </div>
          <div className="chart-body">
            <div className="line-chart">
              <div className="chart-grid">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="grid-line"></div>
                ))}
              </div>
              <div className="line-plot">
                {outpassData.map((item, index) => {
                  const maxOutpassCount = Math.max(1, ...outpassData.map((entry) => entry.count || 0));
                  const height = ((item.count || 0) / maxOutpassCount) * 100;
                  return (
                    <div key={index} className="plot-point">
                      <div
                        className="plot-bar plot-bar-outpass"
                        style={{ height: `${Math.max(2, height)}%` }}
                        title={`${item.month}: ${item.count}`}
                      ></div>
                      <div 
                        className="point point-outpass"
                        style={{ bottom: `${height}%` }}
                        title={`${item.month}: ${item.count}`}
                      >
                        <span className="point-value">{item.count}</span>
                      </div>
                      <div className="point-label">{item.month}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Leave Activity Chart */}
        <div className="chart-container">
          <div className="chart-header">
            <h3>Leave Requests by Month</h3>
            <span className="chart-subtitle">Last 6 Months</span>
          </div>
          <div className="chart-body">
            <div className="line-chart">
              <div className="chart-grid">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="grid-line"></div>
                ))}
              </div>
              <div className="line-plot">
                {leaveData.map((item, index) => {
                  const maxLeaveCount = Math.max(1, ...leaveData.map((entry) => entry.count || 0));
                  const height = ((item.count || 0) / maxLeaveCount) * 100;
                  return (
                    <div key={index} className="plot-point">
                      <div
                        className="plot-bar plot-bar-leave"
                        style={{ height: `${Math.max(2, height)}%` }}
                        title={`${item.month}: ${item.count}`}
                      ></div>
                      <div
                        className="point point-leave"
                        style={{ bottom: `${height}%` }}
                        title={`${item.month}: ${item.count}`}
                      >
                        <span className="point-value">{item.count}</span>
                      </div>
                      <div className="point-label">{item.month}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reports Table */}
      <div className="reports-table-section">
        <div className="section-header">
          <h2>Available Reports</h2>
          <button 
            className="btn-primary"
            onClick={handleGenerateReport}
            disabled={generatingReport}
          >
            {generatingReport ? '⏳ Generating...' : '📥 Generate New Report'}
          </button>
        </div>

        <div className="table-container">
          <table className="reports-table">
            <thead>
              <tr>
                <th>Report Name</th>
                <th>Description</th>
                <th>Last Updated</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.id}>
                  <td className="report-col-name" data-label="Report Name">
                    <div className="report-name">
                      <span className="report-icon">📊</span>
                      {report.name}
                    </div>
                  </td>
                  <td className="report-description report-col-description" data-label="Description">{report.description}</td>
                  <td className="report-col-date" data-label="Last Updated">
                    {new Date(report.lastUpdated).toLocaleDateString('en-GB', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </td>
                  <td className="report-col-status" data-label="Status">
                    <span className={`status-badge ${report.status === 'Ready' ? 'badge-ready' : 'badge-processing'}`}>
                      {report.status}
                    </span>
                  </td>
                  <td className="report-col-actions" data-label="Actions">
                    <div className="actions-cell">
                      <button 
                        className="btn-action btn-view"
                        onClick={() => handleViewReport(report)}
                        title="View Report"
                      >
                        👁️
                      </button>
                      <button 
                        className="btn-action btn-download"
                        onClick={() => handleDownloadReport(report)}
                        title="Download Report"
                        disabled={report.status !== 'Ready'}
                      >
                        📥
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Report Viewer Modal */}
      {viewingReport && (
        <div className="modal-overlay reports-modal-overlay" onClick={() => setViewingReport(null)}>
          <div className="modal-content reports-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{viewingReport.name}</h3>
              <button 
                className="modal-close"
                onClick={() => setViewingReport(null)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="report-preview">
                <div className="preview-section">
                  <h4>Report Details</h4>
                  <div className="detail-row">
                    <span className="detail-label">Report Name:</span>
                    <span className="detail-value">{viewingReport.name}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Description:</span>
                    <span className="detail-value">{viewingReport.description}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Last Updated:</span>
                    <span className="detail-value">
                      {new Date(viewingReport.lastUpdated).toLocaleDateString('en-GB', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Status:</span>
                    <span className={`status-badge ${viewingReport.status === 'Ready' ? 'badge-ready' : 'badge-processing'}`}>
                      {viewingReport.status}
                    </span>
                  </div>
                </div>

                <div className="preview-section">
                  <h4>Report Content</h4>
                  <div className="content-preview">
                    {viewingReport.type === 'occupancy' || viewingReport.name.includes('Occupancy') ? (
                      <>
                        <div className="stat-row">
                          <span>Total Rooms:</span>
                          <strong>{analyticsData.totalRooms}</strong>
                        </div>
                        <div className="stat-row">
                          <span>Occupied Rooms:</span>
                          <strong>{analyticsData.occupiedRooms}</strong>
                        </div>
                        <div className="stat-row">
                          <span>Vacant Rooms:</span>
                          <strong>{analyticsData.vacantRooms}</strong>
                        </div>
                        <div className="stat-row">
                          <span>Occupancy Rate:</span>
                          <strong>{analyticsData.totalRooms > 0 ? ((analyticsData.occupiedRooms / analyticsData.totalRooms) * 100).toFixed(2) : 0}%</strong>
                        </div>
                      </>
                    ) : viewingReport.type === 'complaints' || viewingReport.name.includes('Complaint') ? (
                      <>
                        <div className="stat-row">
                          <span>Total Complaints:</span>
                          <strong>{analyticsData.totalComplaints}</strong>
                        </div>
                        <div className="stat-row">
                          <span>Pending:</span>
                          <strong>{analyticsData.pendingComplaints}</strong>
                        </div>
                        <div className="stat-row">
                          <span>Active (Assigned / In Progress / Delayed):</span>
                          <strong>{analyticsData.activeComplaints}</strong>
                        </div>
                        <div className="stat-row">
                          <span>&nbsp;&nbsp;— of which Delayed:</span>
                          <strong>{analyticsData.delayedComplaints}</strong>
                        </div>
                        <div className="stat-row">
                          <span>Resolved (incl. Closed):</span>
                          <strong>{analyticsData.resolvedComplaints}</strong>
                        </div>
                        <div className="stat-row">
                          <span>Cancelled:</span>
                          <strong>{analyticsData.cancelledComplaints}</strong>
                        </div>
                        <div className="stat-row">
                          <span>Resolution Rate:</span>
                          <strong>{analyticsData.totalComplaints > 0 ? ((analyticsData.resolvedComplaints / analyticsData.totalComplaints) * 100).toFixed(2) : 0}%</strong>
                        </div>
                      </>
                    ) : viewingReport.type === 'outpass' || viewingReport.name.includes('Outpass') ? (
                      <>
                        <div className="stat-row">
                          <span>Total Outpasses:</span>
                          <strong>{analyticsData.totalOutpasses}</strong>
                        </div>
                        <div className="stat-row">
                          <span>Pending Approval:</span>
                          <strong>{analyticsData.pendingOutpasses}</strong>
                        </div>
                        <div className="stat-row">
                          <span>Approved &amp; Out:</span>
                          <strong>{analyticsData.activeOutpasses}</strong>
                        </div>
                        <div className="stat-row">
                          <span>Returned:</span>
                          <strong>{analyticsData.returnedOutpasses}</strong>
                        </div>
                        <div className="stat-row">
                          <span>Overdue:</span>
                          <strong>{analyticsData.overdueOutpasses}</strong>
                        </div>
                        <div className="stat-row">
                          <span>Rejected:</span>
                          <strong>{analyticsData.rejectedOutpasses}</strong>
                        </div>
                        <div className="stat-row">
                          <span>Return Rate:</span>
                          <strong>{analyticsData.totalOutpasses > 0 ? ((analyticsData.returnedOutpasses / analyticsData.totalOutpasses) * 100).toFixed(2) : 0}%</strong>
                        </div>
                      </>
                    ) : viewingReport.type === 'leave' || viewingReport.name.includes('Leave') ? (
                      <>
                        <div className="stat-row">
                          <span>Total Leave Requests:</span>
                          <strong>{analyticsData.totalLeaves}</strong>
                        </div>
                        <div className="stat-row">
                          <span>Pending:</span>
                          <strong>{analyticsData.pendingLeaves}</strong>
                        </div>
                        <div className="stat-row">
                          <span>Approved (incl. Active &amp; Completed):</span>
                          <strong>{analyticsData.approvedLeaves}</strong>
                        </div>
                        <div className="stat-row">
                          <span>&nbsp;&nbsp;— Currently Active:</span>
                          <strong>{analyticsData.activeLeaves}</strong>
                        </div>
                        <div className="stat-row">
                          <span>&nbsp;&nbsp;— Completed:</span>
                          <strong>{analyticsData.completedLeaves}</strong>
                        </div>
                        <div className="stat-row">
                          <span>Rejected:</span>
                          <strong>{analyticsData.rejectedLeaves}</strong>
                        </div>
                        <div className="stat-row">
                          <span>Cancelled:</span>
                          <strong>{analyticsData.cancelledLeaves}</strong>
                        </div>
                        <div className="stat-row">
                          <span>Expired:</span>
                          <strong>{analyticsData.expiredLeaves}</strong>
                        </div>
                        <div className="stat-row">
                          <span>Approval Rate:</span>
                          <strong>{analyticsData.totalLeaves > 0 ? ((analyticsData.approvedLeaves / analyticsData.totalLeaves) * 100).toFixed(2) : 0}%</strong>
                        </div>
                      </>
                    ) : viewingReport.type === 'registration' || viewingReport.name.includes('Registration') ? (
                      <>
                        <div className="stat-row">
                          <span>Total Registered:</span>
                          <strong>{analyticsData.totalRegistrations}</strong>
                        </div>
                        <div className="stat-row">
                          <span>Accepted:</span>
                          <strong>{analyticsData.approvedRegistrations}</strong>
                        </div>
                        <div className="stat-row">
                          <span>Rejected:</span>
                          <strong>{analyticsData.rejectedRegistrations}</strong>
                        </div>
                        <div className="stat-row">
                          <span>Pending Review:</span>
                          <strong>{analyticsData.pendingRegistrations}</strong>
                        </div>
                        <div className="stat-row">
                          <span>Fees Paid (of Accepted):</span>
                          <strong>{analyticsData.feesPaidRegistrations}</strong>
                        </div>
                        <div className="stat-row">
                          <span>Fees Pending (of Accepted):</span>
                          <strong>{Math.max(0, analyticsData.approvedRegistrations - analyticsData.feesPaidRegistrations)}</strong>
                        </div>
                        <div className="stat-row">
                          <span>Acceptance Rate:</span>
                          <strong>{analyticsData.totalRegistrations > 0 ? ((analyticsData.approvedRegistrations / analyticsData.totalRegistrations) * 100).toFixed(2) : 0}%</strong>
                        </div>
                      </>
                    ) : viewingReport.type === 'overview' || viewingReport.name.includes('Overview') ? (
                      <>
                        <div className="stat-row"><span style={{fontWeight:700,color:'#4f46e5'}}>── Students ──</span><strong></strong></div>
                        <div className="stat-row"><span>Total Students:</span><strong>{analyticsData.totalStudents}</strong></div>
                        <div className="stat-row"><span>Total Rooms:</span><strong>{analyticsData.totalRooms}</strong></div>
                        <div className="stat-row"><span>Occupied Rooms:</span><strong>{analyticsData.occupiedRooms}</strong></div>
                        <div className="stat-row"><span>Vacant Rooms:</span><strong>{analyticsData.vacantRooms}</strong></div>
                        <div className="stat-row"><span>Room Occupancy Rate:</span><strong>{analyticsData.totalRooms > 0 ? ((analyticsData.occupiedRooms / analyticsData.totalRooms) * 100).toFixed(2) : 0}%</strong></div>
                        <div className="stat-row"><span style={{fontWeight:700,color:'#4f46e5'}}>── Complaints ──</span><strong></strong></div>
                        <div className="stat-row"><span>Total Complaints:</span><strong>{analyticsData.totalComplaints}</strong></div>
                        <div className="stat-row"><span>Pending:</span><strong>{analyticsData.pendingComplaints}</strong></div>
                        <div className="stat-row"><span>Active (Assigned / In Progress / Delayed):</span><strong>{analyticsData.activeComplaints}</strong></div>
                        <div className="stat-row"><span>&nbsp;&nbsp;— of which Delayed:</span><strong>{analyticsData.delayedComplaints}</strong></div>
                        <div className="stat-row"><span>Resolved (incl. Closed):</span><strong>{analyticsData.resolvedComplaints}</strong></div>
                        <div className="stat-row"><span>Cancelled:</span><strong>{analyticsData.cancelledComplaints}</strong></div>
                        <div className="stat-row"><span>Resolution Rate:</span><strong>{analyticsData.totalComplaints > 0 ? ((analyticsData.resolvedComplaints / analyticsData.totalComplaints) * 100).toFixed(2) : 0}%</strong></div>
                        <div className="stat-row"><span style={{fontWeight:700,color:'#4f46e5'}}>── Outpasses ──</span><strong></strong></div>
                        <div className="stat-row"><span>Total Outpasses:</span><strong>{analyticsData.totalOutpasses}</strong></div>
                        <div className="stat-row"><span>Pending Approval:</span><strong>{analyticsData.pendingOutpasses}</strong></div>
                        <div className="stat-row"><span>Approved &amp; Out:</span><strong>{analyticsData.activeOutpasses}</strong></div>
                        <div className="stat-row"><span>Returned:</span><strong>{analyticsData.returnedOutpasses}</strong></div>
                        <div className="stat-row"><span>Overdue:</span><strong>{analyticsData.overdueOutpasses}</strong></div>
                        <div className="stat-row"><span>Rejected:</span><strong>{analyticsData.rejectedOutpasses}</strong></div>
                        <div className="stat-row"><span>Return Rate:</span><strong>{analyticsData.totalOutpasses > 0 ? ((analyticsData.returnedOutpasses / analyticsData.totalOutpasses) * 100).toFixed(2) : 0}%</strong></div>
                        <div className="stat-row"><span style={{fontWeight:700,color:'#4f46e5'}}>── Leaves ──</span><strong></strong></div>
                        <div className="stat-row"><span>Total Leave Requests:</span><strong>{analyticsData.totalLeaves}</strong></div>
                        <div className="stat-row"><span>Pending:</span><strong>{analyticsData.pendingLeaves}</strong></div>
                        <div className="stat-row"><span>Approved (incl. Active &amp; Completed):</span><strong>{analyticsData.approvedLeaves}</strong></div>
                        <div className="stat-row"><span>&nbsp;&nbsp;— Currently Active:</span><strong>{analyticsData.activeLeaves}</strong></div>
                        <div className="stat-row"><span>&nbsp;&nbsp;— Completed:</span><strong>{analyticsData.completedLeaves}</strong></div>
                        <div className="stat-row"><span>Rejected:</span><strong>{analyticsData.rejectedLeaves}</strong></div>
                        <div className="stat-row"><span>Cancelled:</span><strong>{analyticsData.cancelledLeaves}</strong></div>
                        <div className="stat-row"><span>Expired:</span><strong>{analyticsData.expiredLeaves}</strong></div>
                        <div className="stat-row"><span>Approval Rate:</span><strong>{analyticsData.totalLeaves > 0 ? ((analyticsData.approvedLeaves / analyticsData.totalLeaves) * 100).toFixed(2) : 0}%</strong></div>
                        <div className="stat-row"><span style={{fontWeight:700,color:'#4f46e5'}}>── Registrations ──</span><strong></strong></div>
                        <div className="stat-row"><span>Total Registered:</span><strong>{analyticsData.totalRegistrations}</strong></div>
                        <div className="stat-row"><span>Accepted:</span><strong>{analyticsData.approvedRegistrations}</strong></div>
                        <div className="stat-row"><span>Rejected:</span><strong>{analyticsData.rejectedRegistrations}</strong></div>
                        <div className="stat-row"><span>Pending Review:</span><strong>{analyticsData.pendingRegistrations}</strong></div>
                        <div className="stat-row"><span>Fees Paid (of Accepted):</span><strong>{analyticsData.feesPaidRegistrations}</strong></div>
                        <div className="stat-row"><span>Fees Pending (of Accepted):</span><strong>{Math.max(0, analyticsData.approvedRegistrations - analyticsData.feesPaidRegistrations)}</strong></div>
                        <div className="stat-row"><span>Acceptance Rate:</span><strong>{analyticsData.totalRegistrations > 0 ? ((analyticsData.approvedRegistrations / analyticsData.totalRegistrations) * 100).toFixed(2) : 0}%</strong></div>
                      </>
                    ) : (
                      <>
                        <div className="stat-row">
                          <span>Total Students:</span>
                          <strong>{analyticsData.totalStudents}</strong>
                        </div>
                        <div className="stat-row">
                          <span>Total Rooms:</span>
                          <strong>{analyticsData.totalRooms}</strong>
                        </div>
                        <div className="stat-row">
                          <span>Total Complaints:</span>
                          <strong>{analyticsData.totalComplaints}</strong>
                        </div>
                        <div className="stat-row">
                          <span>Total Outpasses:</span>
                          <strong>{analyticsData.totalOutpasses}</strong>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn-secondary"
                onClick={() => setViewingReport(null)}
              >
                Close
              </button>
              <button 
                className="btn-primary"
                onClick={() => {
                  handleDownloadReport(viewingReport);
                  setViewingReport(null);
                }}
              >
                📥 Download Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminReports;


