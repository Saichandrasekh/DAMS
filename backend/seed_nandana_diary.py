"""Seed sample diary entries for Nandana School — for the demo.

Adds:
  - 6 school-wide announcements from the principal
  - 1-3 class entries per class from various teachers (homework, notes)

Idempotent-ish: only inserts if Nandana has < 5 diary entries already
(re-running won't pile up duplicates).

Run:
    .\\venv\\Scripts\\python.exe seed_nandana_diary.py
"""
import os
import random
import sqlite3
import datetime
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

random.seed(99)

DB = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'database', 'attendance.db')

ANNOUNCEMENTS = [
    {
        'title': 'Annual Sports Day — 2026-06-15',
        'content': 'Dear Students and Parents,\n\nWe are pleased to announce that Nandana School will host its Annual Sports Day on Saturday, 15th June 2026 at the school grounds.\n\nEvents include:\n  • Track events (100m, 200m, 400m, relay)\n  • Field events (long jump, shot put)\n  • House march-past\n  • Tug of war\n\nAll students are expected to attend in their House colors. Registration for individual events closes on 5th June.',
        'days_ago': 2,
    },
    {
        'title': 'Parent-Teacher Meeting — Mid-Term Review',
        'content': 'The Mid-Term PTM is scheduled for Saturday, 31st May 2026 from 9:00 AM to 1:00 PM.\n\nClass-wise schedule:\n  • Grades 6 & 7: 9:00 AM – 10:30 AM\n  • Grades 8 & 9: 10:45 AM – 12:00 PM\n  • Grade 10: 12:00 PM – 1:00 PM\n\nReport cards will be distributed and discussed. Please review the diary and report card on the portal before attending.',
        'days_ago': 5,
    },
    {
        'title': 'School Reopening After Summer Break',
        'content': 'School will reopen on Monday, 2nd June 2026 after the summer vacation. All students should bring their completed holiday assignments, updated diaries, and stationery.\n\nUniform check will be conducted on the first day. Please ensure haircut, ID cards, and proper school uniform.',
        'days_ago': 8,
    },
    {
        'title': 'Science Exhibition — Save the Date',
        'content': 'Nandana School proudly presents its annual Science Exhibition on 28th July 2026. Students from grades 6 to 10 are invited to submit their project proposals to their Science teacher by 30th June.\n\nTheme this year: "Sustainable Living — Small Solutions, Big Impact".\n\nWinners will represent the school at the district-level competition.',
        'days_ago': 12,
    },
    {
        'title': 'Fee Payment Reminder — June Installment',
        'content': 'A gentle reminder to all parents that the June 2026 tuition fee is due by the 10th of the month.\n\nPayments can be made via:\n  • UPI (preferred)\n  • Bank transfer\n  • Cash at the school office (9 AM – 3 PM)\n\nReceipts will be issued for every payment. Please contact the office for any queries.',
        'days_ago': 1,
    },
    {
        'title': 'Library Week — 16th to 22nd June',
        'content': 'Nandana School Library invites all students to participate in Library Week.\n\nActivities:\n  • Book swap (bring 1, take 1)\n  • Reading challenge (per grade)\n  • Author visit on Friday\n  • Best book review contest — prizes for top 3 per grade\n\nLet\'s build the habit of reading!',
        'days_ago': 3,
    },
]

# Class-entry templates by subject area (teacher will be matched at insert time)
HOMEWORK_TEMPLATES = {
    'Mathematics': [
        ('Practice — chapter 4 exercises 1–10',
         'Complete questions 1 to 10 from chapter 4 (Linear Equations). Show all working. Submit by next class. Revise the formulas we discussed today.'),
        ('Geometry construction practice',
         'Using compass and ruler, construct: (a) angle bisector of 60°, (b) perpendicular bisector of a 7cm line. Draw neatly in the practice notebook.'),
        ('Word problems homework',
         'Solve word problems 11–18 from textbook page 78. These are application problems — read carefully and identify what is asked before forming the equation.'),
    ],
    'Science': [
        ('Photosynthesis — diagram + 5 questions',
         'Draw a labelled diagram of photosynthesis in your notebook. Then answer questions 1 to 5 from the chapter exercise. We will discuss the process step-by-step tomorrow.'),
        ('Lab report due — magnet experiment',
         'Write up the lab observation from today\'s experiment on magnetic poles. Use the format: aim, materials, procedure, observation, conclusion. Submit by Friday.'),
        ('Reading — chapter on simple machines',
         'Read pages 45–58 of the textbook (Simple Machines chapter). Highlight the six types of simple machines and bring questions to class for discussion.'),
    ],
    'Physics & Chemistry': [
        ('Numerical problems — motion',
         'Solve 8 numerical problems on uniform motion (page 92). Use the formula sheet we made in class. Show diagrams where required.'),
        ('Chemistry — periodic table practice',
         'Memorize the first 20 elements of the periodic table (symbols, atomic numbers). Short test on Wednesday.'),
    ],
    'English': [
        ('Essay — "My Favorite Book" (200 words)',
         'Write a 200-word essay on your favorite book. Include: title, author, why you liked it, what you learned. Neat handwriting, no spelling mistakes.'),
        ('Reading comprehension exercise',
         'Read the passage on pages 110–112 and answer questions a to h. Pay attention to inferential questions — they need thinking, not just copy-paste.'),
        ('Grammar worksheet — tenses',
         'Complete the grammar worksheet on present perfect and past perfect tenses. We will go through it together in the next class.'),
    ],
    'Social Studies': [
        ('Map work — India physical features',
         'On a blank political map of India, mark and label: 5 major rivers, 3 mountain ranges, and 5 plateaus. Use different colors. Submit on Monday.'),
        ('Project — local heritage',
         'In groups of 4, prepare a 5-minute presentation on any local heritage site or tradition. Photos / drawings encouraged. Presentations next Friday.'),
        ('Read and notes — chapter on government',
         'Read the chapter on "How Government Works" and prepare short notes (1 page max) covering: 3 branches, their roles, examples.'),
    ],
    'Computer Basics': [
        ('Typing practice — 100 words per minute target',
         'Practice typing for 20 minutes daily this week using the online typing tool. Note your speed and accuracy each day. We will check progress next Wednesday.'),
        ('Draw a flowchart — daily routine',
         'Draw a simple flowchart showing your daily morning routine, using only the symbols we learned today (start/end, process, decision). Bring it to class.'),
    ],
    'Computer Applications': [
        ('HTML practice — build a simple page',
         'Create an HTML page about your favorite hobby using: heading tags (h1, h2), paragraphs, an unordered list, and one image. Save the file and bring it next class.'),
    ],
    'Information Technology': [
        ('MS Excel — basic formulas exercise',
         'Open the practice file from the class drive. Complete the SUM, AVERAGE, MAX, MIN, and IF formula exercises. Save with your name and submit.'),
    ],
    'Computer Science': [
        ('Python — write 3 small programs',
         'Write Python programs to: (1) check if a number is prime, (2) find the factorial, (3) reverse a string. Test each program and save in your folder.'),
    ],
}

CLASS_NOTES = [
    'Today we covered the introduction to the new chapter. Slides will be uploaded by evening. Revise the main points before next class.',
    'Class was extended by 10 minutes today to finish the demonstration. Please complete the practice questions at home.',
    'Quick reminder: bring your project material for next class. Those who haven\'t submitted last week\'s assignment please do so by tomorrow.',
    'Good participation in today\'s discussion! Keep it up. Tomorrow we move to the next topic — please read pages 40–45 in advance.',
]


def main():
    if not os.path.exists(DB):
        print('ERROR: database not found at', DB, file=sys.stderr)
        return 1

    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row

    school = conn.execute("SELECT id FROM schools WHERE code='NAND'").fetchone()
    if not school:
        print('ERROR: Nandana school (code NAND) not found. Run seed_nandana.py first.')
        conn.close()
        return 1
    sid = school['id']

    # Idempotency check
    existing = conn.execute(
        'SELECT COUNT(*) c FROM diary_entries WHERE school_id=?', (sid,),
    ).fetchone()['c']
    if existing >= 5:
        print(f'Nandana already has {existing} diary entries — skipping to avoid duplicates.')
        print('Delete existing entries first if you want to re-seed.')
        conn.close()
        return 0

    principal = conn.execute(
        "SELECT id, name FROM users WHERE school_id=? AND role IN ('admin','principal') ORDER BY id LIMIT 1",
        (sid,),
    ).fetchone()
    if not principal:
        print('ERROR: no admin/principal user found.')
        conn.close()
        return 1
    print(f'Principal: #{principal["id"]} {principal["name"]}')

    classes = conn.execute(
        "SELECT id, name, section FROM classes WHERE school_id=? ORDER BY name, section",
        (sid,),
    ).fetchall()
    print(f'Classes: {len(classes)}')

    today = datetime.date.today()

    # ─── School-wide announcements from principal ─────────────────────────
    ann_count = 0
    for a in ANNOUNCEMENTS:
        d = (today - datetime.timedelta(days=a['days_ago'])).isoformat()
        conn.execute('''
            INSERT INTO diary_entries (school_id, scope, class_id, subject_id, title, content, link, entry_date, posted_by)
            VALUES (?, 'school', NULL, NULL, ?, ?, NULL, ?, ?)
        ''', (sid, a['title'], a['content'], d, principal['id']))
        ann_count += 1
    print(f'OK  {ann_count} school-wide announcements')

    # ─── Class entries from teachers ──────────────────────────────────────
    class_entry_count = 0
    for cls in classes:
        subjects = conn.execute('''
            SELECT s.id, s.name, s.teacher_id, u.name AS teacher_name
            FROM subjects s
            JOIN users u ON u.id = s.teacher_id
            WHERE s.class_id = ?
        ''', (cls['id'],)).fetchall()
        if not subjects:
            continue

        # 2-3 entries per class, spread over recent days
        entries_for_class = random.randint(2, 3)
        used_subject_ids = set()
        for _ in range(entries_for_class):
            sub = random.choice(subjects)
            templates = HOMEWORK_TEMPLATES.get(sub['name'])
            if not templates:
                # generic class note if no template for this subject
                title = f'{sub["name"]} — class notes'
                content = random.choice(CLASS_NOTES)
            else:
                title, content = random.choice(templates)
            d = (today - datetime.timedelta(days=random.randint(0, 6))).isoformat()
            conn.execute('''
                INSERT INTO diary_entries
                (school_id, scope, class_id, subject_id, title, content, link, entry_date, posted_by)
                VALUES (?, 'class', ?, ?, ?, ?, NULL, ?, ?)
            ''', (sid, cls['id'], sub['id'], title, content, d, sub['teacher_id']))
            class_entry_count += 1
            used_subject_ids.add(sub['id'])

    print(f'OK  {class_entry_count} class entries across {len(classes)} classes')

    conn.commit()
    total = conn.execute(
        'SELECT COUNT(*) c FROM diary_entries WHERE school_id=?', (sid,),
    ).fetchone()['c']
    conn.close()

    print()
    print('=' * 60)
    print(f'  Total diary entries for Nandana: {total}')
    print('=' * 60)
    print('Login as principal -> Diary tab to see announcements')
    print('Login as a student -> Diary to see their class entries')
    print('=' * 60)
    return 0


if __name__ == '__main__':
    sys.exit(main())
