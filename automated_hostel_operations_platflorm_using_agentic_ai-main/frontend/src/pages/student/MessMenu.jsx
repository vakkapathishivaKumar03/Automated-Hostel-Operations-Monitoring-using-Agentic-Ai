import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../styles/student-mess.css';

const MessMenu = () => {
  const navigate = useNavigate();
  const [currentDay, setCurrentDay] = useState('');
  const [currentDayIndex, setCurrentDayIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  const [messMenu, setMessMenu] = useState({
    Monday: {
      breakfast: 'Idli, Sambar, Palli Chutney, Ginger Chutney - Tea & Milk',
      lunch: 'Plain Rice, Cabbage Fry, Tomato Dal, Drumstick Sambar - Curd, Papad & Chutneys',
      snacks: 'Veg & Egg Noodles / Onion Samosa - Tea & Milk',
      dinner: 'Plain Rice, Bobbatlu, Brinjal Curry, Kandagadala Curry, Methi Dal, Egg Fry, Tomato Rasam - Curd, Papad & Chutneys',
    },
    Tuesday: {
      breakfast: 'Uthappam / Pesarattu, Palli Chutney, Ginger Chutney - Tea & Milk',
      lunch: 'Plain Rice, Bendi Fry/Curry, Thotakura Dal, Miriyalu Rasam - Curd, Papad & Chutneys',
      snacks: 'Veg Puff & Egg Puff - Tea & Milk',
      dinner: 'Plain Rice, Mixed Vegetable Curry, Egg Curry, Dal Tadka, Chapathi, Carrot Sambar - Curd, Papad & Chutneys',
    },
    Wednesday: {
      breakfast: 'Wada, Sambar, Palli Chutney, Ginger Chutney - Tea & Milk',
      lunch: 'Plain Rice, Chikkudukaya Tomato Curry, Pumpkin Sambar, Dosakaya Dal - Curd, Papad & Chutneys',
      snacks: 'Mixed Fruits (Separate) / Sweet Corn / Banana - Tea & Milk',
      dinner: 'Plain Rice, Bagara Rice, Chicken Curry, Paneer Butter Masala, Pumpkin Sambar, Raita - Curd, Papad & Chutneys',
    },
    Thursday: {
      breakfast: 'Dosa, Aloo Masala Curry, Palli Chutney, Ginger Chutney - Tea & Milk',
      lunch: 'Plain Rice, Methi Dal, Donda Fry/Curry, Tomato Rasam - Curd, Papad & Chutneys',
      snacks: 'Cool Cake / Pineapple Cake / Butterscotch Cake / Plum Cake - Tea & Milk',
      dinner: 'Plain Rice, Chapathi, Dal Fry, Meal Maker / Rajma, Egg Burji / Egg Masala, Majjiga Charu - Curd, Papad & Chutneys',
    },
    Friday: {
      breakfast: 'Lemon Rice / Tamarind Rice, Upma, Bread Jam, Tomato Chutney, Palli Chutney - Tea & Milk',
      lunch: 'Plain Rice, Aahu Curry/Fry, Chukkakura Dal, Sorakaya Sambar - Curd, Papad & Chutneys',
      snacks: 'Punugulu / Mirchi Bajji - Tea & Milk',
      dinner: 'Plain Rice, Egg/Veg Fried Rice OR Veg Pulav, Tomato Egg Curry, Aahu Curry, Carrot Sambar - Curd, Papad & Chutneys',
    },
    Saturday: {
      breakfast: 'Mysore Bonda, Tomato Chutney, Palli Chutney - Tea & Milk',
      lunch: 'Plain Rice, Mixed Veg Curry, Bachalakara Dal, Rasam/Sambar - Curd, Papad & Chutneys',
      snacks: 'Dil Pasand / Donuts / Burger / Dil Kush - Tea & Milk',
      dinner: 'Plain Rice, Sambar Rice, Thotakura Dal, Gobi Manchuria / Veg Manchuria, Miriyalu Rasam, Boiled Egg - Curd, Papad & Chutneys',
    },
    Sunday: {
      breakfast: 'Chapathi, Chole Curry - Tea & Milk',
      lunch: 'Plain Rice, Brinjal Curry, Moong Dal, Carrot Sambar - Curd, Papad & Chutneys',
      snacks: 'Cashew / Moon Fruit / Osmania Biscuits - Tea & Milk',
      dinner: 'Plain Rice, Bagara Rice, Chicken Curry / Chicken Biryani, Paneer Butter Masala / Paneer Biryani, Carrot Sambar, Raita, Double Ka Meetha (2 times) / Semiya Payasam / Kadduka Kheer - Curd, Papad & Chutneys',
    },
  });

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  useEffect(() => {
    const today = new Date().getDay();
    const dayIndex = (today + 6) % 7;
    setCurrentDayIndex(dayIndex);
    setCurrentDay(days[dayIndex]);
    
    // Fetch menu from backend
    fetchMessMenu();
  }, []);

  const fetchMessMenu = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/mess/menu');
      const data = await response.json();
      
      if (data.success && data.data) {
        // Convert API response to component format (arrays to comma-separated strings)
        const formattedMenu = {};
        Object.keys(data.data).forEach(day => {
          formattedMenu[day] = {};
          Object.keys(data.data[day]).forEach(meal => {
            const items = data.data[day][meal].items || [];
            formattedMenu[day][meal] = items.join(', ');
          });
        });
        
        // Only update if we have valid data
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

  const todayMeals = messMenu[currentDay];

  return (
    <>
          <main className="student-main">
          <header className="mess-header">
            <div>
              <h1 className="mess-title">Mess Menu</h1>
              <p className="mess-subtitle">View today's meals and weekly schedule</p>
            </div>
          </header>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
              Loading menu...
            </div>
          ) : (
            <div className="mess-content">
              <section className="todays-menu-section">
                <div className="todays-menu-header">
                  <h2>Today's Menu</h2>
                  <span className="todays-badge">{currentDay}</span>
                </div>

                {todayMeals && (
                  <div className="meals-grid">
                    <div className="meal-card breakfast">
                      <div className="meal-icon">🌅</div>
                      <div className="meal-name">Breakfast</div>
                      <div className="meal-items">{todayMeals.breakfast}</div>
                    </div>

                    <div className="meal-card lunch">
                      <div className="meal-icon">☀️</div>
                      <div className="meal-name">Lunch</div>
                      <div className="meal-items">{todayMeals.lunch}</div>
                    </div>

                    <div className="meal-card snacks">
                      <div className="meal-icon">☕</div>
                      <div className="meal-name">Snacks</div>
                      <div className="meal-items">{todayMeals.snacks}</div>
                    </div>

                    <div className="meal-card dinner">
                      <div className="meal-icon">🌙</div>
                      <div className="meal-name">Dinner</div>
                      <div className="meal-items">{todayMeals.dinner}</div>
                    </div>
                  </div>
                )}
              </section>

              <section className="weekly-schedule-section">
                <h2>Weekly Schedule</h2>
                <div className="weekly-table-wrapper">
                  <table className="weekly-table">
                    <thead>
                      <tr>
                        <th>Day</th>
                        <th>Breakfast</th>
                        <th>Lunch</th>
                        <th>Snacks</th>
                        <th>Dinner</th>
                      </tr>
                    </thead>
                    <tbody>
                      {days.map((day, index) => (
                        <tr key={day} className={index === currentDayIndex ? 'today-row' : ''}>
                          <td className="day-cell">
                            <strong>{day}</strong>
                            {index === currentDayIndex && <span className="today-indicator">Today</span>}
                          </td>
                          <td>{messMenu[day].breakfast}</td>
                          <td>{messMenu[day].lunch}</td>
                          <td>{messMenu[day].snacks}</td>
                          <td>{messMenu[day].dinner}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}
          </main>
    </>
  );
};

export default MessMenu;


