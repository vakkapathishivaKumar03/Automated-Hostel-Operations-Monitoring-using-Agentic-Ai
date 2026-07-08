import React from 'react';
import StudentLayout from '../../components/StudentLayout';

// Reusable student page template
const StudentPageTemplate = ({ title, children, headerExtras }) => {
  return (
    <StudentLayout>
      <main className="student-main">
        <header className="page-header">
          <div>
            <h1 className="page-title">{title}</h1>
          </div>
          {headerExtras}
        </header>

        <div className="page-content">{children}</div>
      </main>
    </StudentLayout>
  );
};

export default StudentPageTemplate;
