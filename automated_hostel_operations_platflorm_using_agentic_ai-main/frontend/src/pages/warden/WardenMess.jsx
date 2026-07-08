import React, { useState, useEffect } from 'react';
import '../../styles/warden-mess.css';

const WardenMess = () => {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const [selectedDay, setSelectedDay] = useState('Monday');
  const [editingMeal, setEditingMeal] = useState(null);
  const [editMenuText, setEditMenuText] = useState('');
  const [savingMenu, setSavingMenu] = useState(false);
  const [loading, setLoading] = useState(true);
  // In-modal message state
  const [modalMessage, setModalMessage] = useState(null);
  const [modalMessageType, setModalMessageType] = useState('success');

  // Hostel mess menu data
  const [messMenu, setMessMenu] = useState({
    Monday: {
      breakfast: ['Idli', 'Sambar', 'Palli Chutney', 'Ginger Chutney', 'Tea & Milk (Common)'],
      lunch: ['Plain Rice', 'Cabbage Fry', 'Tomato Dal', 'Drumstick Sambar', 'Curd, Papad & Chutneys (Common)'],
      snacks: ['Veg & Egg Noodles / Onion Samosa', 'Tea & Milk (Common)'],
      dinner: ['Plain Rice', 'Bobbatlu', 'Brinjal Curry', 'Kandagadala Curry', 'Methi Dal', 'Egg Fry', 'Tomato Rasam', 'Curd, Papad & Chutneys (Common)']
    },
    Tuesday: {
      breakfast: ['Uthappam / Pesarattu', 'Palli Chutney', 'Ginger Chutney', 'Tea & Milk (Common)'],
      lunch: ['Plain Rice', 'Bendi Fry/Curry', 'Thotakura Dal', 'Miriyalu Rasam', 'Curd, Papad & Chutneys (Common)'],
      snacks: ['Veg Puff & Egg Puff', 'Tea & Milk (Common)'],
      dinner: ['Plain Rice', 'Mixed Vegetable Curry', 'Egg Curry', 'Dal Tadka', 'Chapathi', 'Carrot Sambar', 'Curd, Papad & Chutneys (Common)']
    },
    Wednesday: {
      breakfast: ['Wada', 'Sambar', 'Palli Chutney', 'Ginger Chutney', 'Tea & Milk (Common)'],
      lunch: ['Plain Rice', 'Chikkudukaya Tomato Curry', 'Pumpkin Sambar', 'Dosakaya Dal', 'Curd, Papad & Chutneys (Common)'],
      snacks: ['Mixed Fruits (Separate) / Sweet Corn / Banana', 'Tea & Milk (Common)'],
      dinner: ['Plain Rice', 'Bagara Rice', 'Chicken Curry', 'Paneer Butter Masala', 'Pumpkin Sambar', 'Raita', 'Curd, Papad & Chutneys (Common)']
    },
    Thursday: {
      breakfast: ['Dosa', 'Aloo Masala Curry', 'Palli Chutney', 'Ginger Chutney', 'Tea & Milk (Common)'],
      lunch: ['Plain Rice', 'Methi Dal', 'Donda Fry/Curry', 'Tomato Rasam', 'Curd, Papad & Chutneys (Common)'],
      snacks: ['Cool Cake / Pineapple Cake / Butterscotch Cake / Plum Cake', 'Tea & Milk (Common)'],
      dinner: ['Plain Rice', 'Chapathi', 'Dal Fry', 'Meal Maker / Rajma', 'Egg Burji / Egg Masala', 'Majjiga Charu', 'Curd, Papad & Chutneys (Common)']
    },
    Friday: {
      breakfast: ['Lemon Rice / Tamarind Rice', 'Upma', 'Bread Jam', 'Tomato Chutney', 'Palli Chutney', 'Tea & Milk (Common)'],
      lunch: ['Plain Rice', 'Aahu Curry/Fry', 'Chukkakura Dal', 'Sorakaya Sambar', 'Curd, Papad & Chutneys (Common)'],
      snacks: ['Punugulu / Mirchi Bajji', 'Tea & Milk (Common)'],
      dinner: ['Plain Rice', 'Egg/Veg Fried Rice OR Veg Pulav', 'Tomato Egg Curry', 'Aahu Curry', 'Carrot Sambar', 'Curd, Papad & Chutneys (Common)']
    },
    Saturday: {
      breakfast: ['Mysore Bonda', 'Tomato Chutney', 'Palli Chutney', 'Tea & Milk (Common)'],
      lunch: ['Plain Rice', 'Mixed Veg Curry', 'Bachalakara Dal', 'Rasam/Sambar', 'Curd, Papad & Chutneys (Common)'],
      snacks: ['Dil Pasand / Donuts / Burger / Dil Kush', 'Tea & Milk (Common)'],
      dinner: ['Plain Rice', 'Sambar Rice', 'Thotakura Dal', 'Gobi Manchuria / Veg Manchuria', 'Miriyalu Rasam', 'Boiled Egg', 'Curd, Papad & Chutneys (Common)']
    },
    Sunday: {
      breakfast: ['Chapathi', 'Chole Curry', 'Tea & Milk (Common)'],
      lunch: ['Plain Rice', 'Brinjal Curry', 'Moong Dal', 'Carrot Sambar', 'Curd, Papad & Chutneys (Common)'],
      snacks: ['Cashew / Moon Fruit / Osmania Biscuits', 'Tea & Milk (Common)'],
      dinner: ['Plain Rice', 'Bagara Rice', 'Chicken Curry / Chicken Biryani', 'Paneer Butter Masala / Paneer Biryani', 'Carrot Sambar', 'Raita', 'Double Ka Meetha (2 times) / Semiya Payasam / Kadduka Kheer', 'Curd, Papad & Chutneys (Common)']
    }
  });

  // Fetch menu from backend on component mount
  useEffect(() => {
    fetchMessMenu();
  }, []);

  const fetchMessMenu = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/mess/menu');
      const data = await response.json();
      
      if (data.success && data.data) {
        // Convert API response to component format
        const formattedMenu = {};
        Object.keys(data.data).forEach(day => {
          formattedMenu[day] = {};
          Object.keys(data.data[day]).forEach(meal => {
            formattedMenu[day][meal] = data.data[day][meal].items || [];
          });
        });
        
        // Only update if we have valid data, otherwise keep default menu
        if (Object.keys(formattedMenu).length > 0) {
          setMessMenu(formattedMenu);
        }
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching mess menu:', error);
      setLoading(false);
      // Keep default menu on error
    }
  };

  // Helper function to show message in modal with auto-dismiss
  const showMessage = (message, type = 'success') => {
    setModalMessage(message);
    setModalMessageType(type);
    setTimeout(() => setModalMessage(null), 3000);
  };

  // Open edit modal
  const handleEditMeal = (mealType) => {
    setEditingMeal(mealType);
    setEditMenuText(messMenu[selectedDay][mealType].join('\n'));
  };

  // Save edited menu
  const handleSaveMenu = async () => {
    if (editMenuText.trim()) {
      const items = editMenuText
        .split('\n')
        .map(item => item.trim())
        .filter(item => item.length > 0);
      
      setSavingMenu(true);
      try {
        // Save to backend
        const response = await fetch('http://localhost:5000/api/mess/menu', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            day_of_week: selectedDay,
            meal_type: editingMeal,
            menu_items: items
          })
        });

        const data = await response.json();
        
        if (data.success) {
          // Update local state
          setMessMenu(prev => ({
            ...prev,
            [selectedDay]: {
              ...prev[selectedDay],
              [editingMeal]: items
            }
          }));
          setEditingMeal(null);
          setEditMenuText('');
          showMessage('Menu updated successfully!', 'success');
        } else {
          showMessage('Failed to update menu: ' + data.message, 'error');
        }
      } catch (error) {
        console.error('Error saving menu:', error);
        showMessage('Error saving menu. Please try again.', 'error');
      } finally {
        setSavingMenu(false);
      }
    }
  };

  // Reset menu
  const handleResetMenu = () => {
    setEditingMeal(null);
    setEditMenuText('');
  };

  // Copy previous day menu
  const handleCopyPreviousDay = () => {
    const currentIndex = days.indexOf(selectedDay);
    if (currentIndex > 0) {
      const previousDay = days[currentIndex - 1];
      setMessMenu(prev => ({
        ...prev,
        [selectedDay]: { ...prev[previousDay] }
      }));
    }
  };

  const currentDayMenu = messMenu[selectedDay];
  const mealTypes = ['breakfast', 'lunch', 'snacks', 'dinner'];
  const mealLabels = {
    breakfast: '🌅 Breakfast',
    lunch: '🍽️ Lunch',
    snacks: '🥜 Snacks',
    dinner: '🌙 Dinner'
  };

  const hasMealData = mealTypes.some(meal => currentDayMenu[meal]?.length > 0);

  return (
    <div className="mess-page">
      {/* Page Header */}
      <div className="page-header-card">
        <div className="page-header-text">
          <h2>Mess Menu</h2>
          <p>Manage daily hostel food menu</p>
        </div>
        <div className="page-header-action">
          <button className="btn-copy" onClick={handleCopyPreviousDay} title="Copy previous day menu">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
              <polyline points="13 2 13 9 20 9"/>
            </svg>
            Copy Previous Day
          </button>
        </div>
      </div>

      {/* Day Selector */}
      <div className="day-selector">
        <div className="day-tabs">
          {days.map(day => (
            <button
              key={day}
              className={`day-tab ${selectedDay === day ? 'active' : ''}`}
              onClick={() => setSelectedDay(day)}
            >
              {day.slice(0, 3)}
            </button>
          ))}
        </div>
        <div className="selected-day-info">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <span>{selectedDay} - Feb 7, 2026</span>
        </div>
      </div>

      {/* Menu Display */}
      {hasMealData ? (
        <div className="mess-menu-grid">
          {mealTypes.map(mealType => (
            <div key={mealType} className="meal-card">
              <div className="meal-header">
                <h3>{mealLabels[mealType]}</h3>
                <button 
                  className="btn-edit"
                  onClick={() => handleEditMeal(mealType)}
                  title={`Edit ${mealType}`}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                  Edit
                </button>
              </div>
              <div className="meal-items">
                {currentDayMenu[mealType] && currentDayMenu[mealType].length > 0 ? (
                  <ul>
                    {currentDayMenu[mealType].map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="no-items">No items added yet</p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/>
            </svg>
          </div>
          <h3>Menu not updated for {selectedDay}</h3>
          <p>Add food items for today's meals using the Edit buttons.</p>
        </div>
      )}

      {/* Edit Modal */}
      {editingMeal && (
        <div className="modal-overlay" onClick={handleResetMenu}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit {mealLabels[editingMeal]}</h2>
              <button className="modal-close" onClick={handleResetMenu}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="modal-body">
              {modalMessage && (
                <div className={`modal-message modal-message-${modalMessageType}`}>
                  <span className="message-icon">{modalMessageType === 'success' ? '✓' : '⚠'}</span>
                  <span className="message-text">{modalMessage}</span>
                </div>
              )}
              <div className="edit-info">
                <p><strong>Day:</strong> {selectedDay}</p>
                <p><strong>Meal:</strong> {mealLabels[editingMeal]}</p>
              </div>

              <div className="form-group">
                <label htmlFor="menu-textarea">Food Items (one per line)</label>
                <textarea
                  id="menu-textarea"
                  className="menu-textarea"
                  value={editMenuText}
                  onChange={(e) => setEditMenuText(e.target.value)}
                  placeholder="Add food items, one per line&#10;Example:&#10;Dosa&#10;Sambhar&#10;Chutney"
                  rows="8"
                />
                <p className="textarea-hint">Add each food item on a new line</p>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-cancel" onClick={handleResetMenu}>
                Cancel
              </button>
              <button className="btn-save" onClick={handleSaveMenu} disabled={savingMenu}>
                {savingMenu ? (
                  <><span className="btn-spinner" /> Saving...</>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                      <polyline points="17 21 17 13 7 13 7 21"/>
                      <polyline points="7 3 7 8 15 8"/>
                    </svg>
                    Save Menu
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WardenMess;


