"""
Optional data seeding script.

Use this after schema creation when you want:
1) default room amenities for empty amenity fields
2) initial weekly mess menu entries
"""

import sys
import os
import mysql.connector


DB_CONFIG = {
    'host': os.getenv('MYSQL_HOST', 'localhost'),
    'user': os.getenv('MYSQL_USER', 'root'),
    'password': os.getenv('MYSQL_PASSWORD', os.getenv('DB_PASSWORD', '')),
    'database': os.getenv('MYSQL_DB', os.getenv('DB_NAME', 'hostelconnect_db'))
}


MESS_MENU = {
    'monday': {
        'breakfast': 'Idli\nSambar\nPalli Chutney\nGinger Chutney\nTea & Milk (Common)',
        'lunch': 'Plain Rice\nCabbage Fry\nTomato Dal\nDrumstick Sambar\nCurd, Papad & Chutneys (Common)',
        'snacks': 'Veg & Egg Noodles / Onion Samosa\nTea & Milk (Common)',
        'dinner': 'Plain Rice\nBobbatlu\nBrinjal Curry\nKandagadala Curry\nMethi Dal\nEgg Fry\nTomato Rasam\nCurd, Papad & Chutneys (Common)'
    },
    'tuesday': {
        'breakfast': 'Uthappam / Pesarattu\nPalli Chutney\nGinger Chutney\nTea & Milk (Common)',
        'lunch': 'Plain Rice\nBendi Fry/Curry\nThotakura Dal\nMiriyalu Rasam\nCurd, Papad & Chutneys (Common)',
        'snacks': 'Veg Puff & Egg Puff\nTea & Milk (Common)',
        'dinner': 'Plain Rice\nMixed Vegetable Curry\nEgg Curry\nDal Tadka\nChapathi\nCarrot Sambar\nCurd, Papad & Chutneys (Common)'
    },
    'wednesday': {
        'breakfast': 'Wada\nSambar\nPalli Chutney\nGinger Chutney\nTea & Milk (Common)',
        'lunch': 'Plain Rice\nChikkudukaya Tomato Curry\nPumpkin Sambar\nDosakaya Dal\nCurd, Papad & Chutneys (Common)',
        'snacks': 'Mixed Fruits (Separate) / Sweet Corn / Banana\nTea & Milk (Common)',
        'dinner': 'Plain Rice\nBagara Rice\nChicken Curry\nPaneer Butter Masala\nPumpkin Sambar\nRaita\nCurd, Papad & Chutneys (Common)'
    },
    'thursday': {
        'breakfast': 'Dosa\nAloo Masala Curry\nPalli Chutney\nGinger Chutney\nTea & Milk (Common)',
        'lunch': 'Plain Rice\nMethi Dal\nDonda Fry/Curry\nTomato Rasam\nCurd, Papad & Chutneys (Common)',
        'snacks': 'Cool Cake / Pineapple Cake / Butterscotch Cake / Plum Cake\nTea & Milk (Common)',
        'dinner': 'Plain Rice\nChapathi\nDal Fry\nMeal Maker / Rajma\nEgg Burji / Egg Masala\nMajjiga Charu\nCurd, Papad & Chutneys (Common)'
    },
    'friday': {
        'breakfast': 'Lemon Rice / Tamarind Rice\nUpma\nBread Jam\nTomato Chutney\nPalli Chutney\nTea & Milk (Common)',
        'lunch': 'Plain Rice\nAahu Curry/Fry\nChukkakura Dal\nSorakaya Sambar\nCurd, Papad & Chutneys (Common)',
        'snacks': 'Punugulu / Mirchi Bajji\nTea & Milk (Common)',
        'dinner': 'Plain Rice\nEgg/Veg Fried Rice OR Veg Pulav\nTomato Egg Curry\nAahu Curry\nCarrot Sambar\nCurd, Papad & Chutneys (Common)'
    },
    'saturday': {
        'breakfast': 'Mysore Bonda\nTomato Chutney\nPalli Chutney\nTea & Milk (Common)',
        'lunch': 'Plain Rice\nMixed Veg Curry\nBachalakara Dal\nRasam/Sambar\nCurd, Papad & Chutneys (Common)',
        'snacks': 'Dil Pasand / Donuts / Burger / Dil Kush\nTea & Milk (Common)',
        'dinner': 'Plain Rice\nSambar Rice\nThotakura Dal\nGobi Manchuria / Veg Manchuria\nMiriyalu Rasam\nBoiled Egg\nCurd, Papad & Chutneys (Common)'
    },
    'sunday': {
        'breakfast': 'Chapathi\nChole Curry\nTea & Milk (Common)',
        'lunch': 'Plain Rice\nBrinjal Curry\nMoong Dal\nCarrot Sambar\nCurd, Papad & Chutneys (Common)',
        'snacks': 'Cashew / Moon Fruit / Osmania Biscuits\nTea & Milk (Common)',
        'dinner': 'Plain Rice\nBagara Rice\nChicken Curry / Chicken Biryani\nPaneer Butter Masala / Paneer Biryani\nCarrot Sambar\nRaita\nDouble Ka Meetha (2 times) / Semiya Payasam / Kadduka Kheer\nCurd, Papad & Chutneys (Common)'
    }
}


def seed_room_amenities(cursor):
    cursor.execute(
        """
        UPDATE rooms
        SET amenities = 'WiFi, Study Table, Wardrobe, Ceiling Fan'
        WHERE amenities IS NULL OR TRIM(amenities) = ''
        """
    )
    return cursor.rowcount


def seed_mess_menu(cursor):
    upsert_count = 0
    for day, meals in MESS_MENU.items():
        for meal_type, menu_items in meals.items():
            cursor.execute(
                """
                SELECT id
                FROM mess_menu
                WHERE day_of_week = %s AND meal_type = %s
                ORDER BY id ASC
                LIMIT 1
                """,
                (day, meal_type)
            )
            existing = cursor.fetchone()

            if existing:
                cursor.execute(
                    """
                    UPDATE mess_menu
                    SET menu_items = %s
                    WHERE id = %s
                    """,
                    (menu_items, existing[0])
                )
            else:
                cursor.execute(
                    """
                    INSERT INTO mess_menu (day_of_week, meal_type, menu_items)
                    VALUES (%s, %s, %s)
                    """,
                    (day, meal_type, menu_items)
                )

            upsert_count += 1

    return upsert_count


def main():
    try:
        print('Connecting to database...')
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor()

        print('Seeding default room amenities...')
        rooms_updated = seed_room_amenities(cursor)

        print('Seeding weekly mess menu...')
        menu_processed = seed_mess_menu(cursor)

        conn.commit()
        cursor.close()
        conn.close()

        print('\nOptional data seed complete:')
        print(f'- Rooms updated with default amenities: {rooms_updated}')
        print(f'- Mess menu day/meal entries processed: {menu_processed}')
        print('\nDone.')
    except Exception as exc:
        print(f'Error while seeding optional data: {exc}')
        sys.exit(1)


if __name__ == '__main__':
    main()
