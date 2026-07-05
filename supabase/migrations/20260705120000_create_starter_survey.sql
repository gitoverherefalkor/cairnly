-- Cairnly Starter survey: new survey for first/second-job seekers (Gen Z "limbo" audience).
-- Fully additive: brand-new survey id + section ids + question ids (a1a1a1a1-... scheme).
-- The live pro survey (00000000-...-0001, question ids 11111111.../22222222/...) is untouched,
-- so the production n8n chain can never receive or misread starter answers.
-- Spec: docs/superpowers/specs/2026-07-05-starter-flavor-design.md

-- ============ Survey ============
INSERT INTO public.surveys (id, title)
VALUES ('00000000-0000-0000-0000-000000000002', 'Starter - First Serious Job - 2026 v1 EN')
ON CONFLICT (id) DO NOTHING;

-- ============ Sections ============
INSERT INTO public.survey_sections (id, survey_id, title, description, order_num) VALUES
  ('a1a1a1a1-0000-4000-a000-000000000001', '00000000-0000-0000-0000-000000000002', 'Getting to know you', 'The basics, so your results actually fit your life.', 1),
  ('a1a1a1a1-0000-4000-a000-000000000002', '00000000-0000-0000-0000-000000000002', 'How you operate', 'No right answers here. We are mapping how you naturally work, not grading you.', 2),
  ('a1a1a1a1-0000-4000-a000-000000000003', '00000000-0000-0000-0000-000000000002', 'What drives you', 'What actually matters to you in work. Be honest, not aspirational.', 3),
  ('a1a1a1a1-0000-4000-a000-000000000004', '00000000-0000-0000-0000-000000000002', 'Interests and strengths', 'You have more evidence about yourself than you think. School, hobbies, side jobs: it all counts.', 4),
  ('a1a1a1a1-0000-4000-a000-000000000005', '00000000-0000-0000-0000-000000000002', 'Where you work best', 'Picture your best working day. We are building the setting.', 5),
  ('a1a1a1a1-0000-4000-a000-000000000006', '00000000-0000-0000-0000-000000000002', 'Practical reality', 'Ambition meets logistics. This keeps the advice realistic.', 6),
  ('a1a1a1a1-0000-4000-a000-000000000007', '00000000-0000-0000-0000-000000000002', 'Looking ahead', 'Last stretch. Say it in your own words.', 7)
ON CONFLICT (id) DO NOTHING;

-- ============ Section 1: Getting to know you ============
INSERT INTO public.questions (id, section_id, type, label, required, allow_multiple, allow_other, order_num, min_selections, max_selections, config) VALUES
  ('a1a1a1a1-0001-4000-a000-000000000001', 'a1a1a1a1-0000-4000-a000-000000000001', 'short_text', 'Your name', true, false, false, 1, NULL, NULL,
   '{"description": "First and last name"}'::jsonb),
  ('a1a1a1a1-0001-4000-a000-000000000002', 'a1a1a1a1-0000-4000-a000-000000000001', 'number', 'Your age', true, false, false, 2, NULL, NULL,
   '{}'::jsonb),
  ('a1a1a1a1-0001-4000-a000-000000000003', 'a1a1a1a1-0000-4000-a000-000000000001', 'dropdown', 'What region are you based?', true, false, false, 3, NULL, NULL,
   '{"choices": ["Northern and Western Europe", "Southern and Eastern Europe", "United Kingdom (London)", "United Kingdom (Other)", "United States (High-Cost Regions)", "United States (Average-Cost Regions)", "United States (Lower-Cost Regions)", "Canada", "Australia and New Zealand", "Switzerland"], "description": "If you are about to move, pick the region you are moving to."}'::jsonb),
  ('a1a1a1a1-0001-4000-a000-000000000004', 'a1a1a1a1-0000-4000-a000-000000000001', 'multiple_choice', 'What''s your current situation?', true, false, true, 4, NULL, NULL,
   '{"choices": ["Studying full-time", "Just graduated, looking for my first serious job", "Working my first job, wondering if it''s the right one", "Working a job I want out of", "Taking a gap or in-between period"]}'::jsonb),
  ('a1a1a1a1-0001-4000-a000-000000000005', 'a1a1a1a1-0000-4000-a000-000000000001', 'dropdown', 'Highest education completed or in progress', true, false, false, 5, NULL, NULL,
   '{"choices": ["High school", "Vocational or trade school", "Associate degree", "Bachelor''s degree", "Master''s degree", "PhD", "Self-taught or online courses", "Other"]}'::jsonb),
  ('a1a1a1a1-0001-4000-a000-000000000006', 'a1a1a1a1-0000-4000-a000-000000000001', 'short_text', 'What did (or do) you study?', true, false, false, 6, NULL, NULL,
   '{"description": "Field of study or main subject. Write \"none\" if not applicable."}'::jsonb),
  ('a1a1a1a1-0001-4000-a000-000000000007', 'a1a1a1a1-0000-4000-a000-000000000001', 'multiple_choice', 'What work experience do you have so far?', true, true, false, 7, 1, NULL,
   '{"choices": ["Side jobs (retail, hospitality, delivery, tutoring...)", "One or more internships", "Volunteering", "Student association or committee work", "Freelance gigs or my own hustle", "Helping in a family business", "None yet, and that''s okay"], "description": "Select everything that applies."}'::jsonb),
  ('a1a1a1a1-0001-4000-a000-000000000008', 'a1a1a1a1-0000-4000-a000-000000000001', 'long_text', 'Tell us about the work you''ve done so far', true, false, false, 8, NULL, NULL,
   '{"max_length": 800, "description": "Jobs, internships, projects. What you actually did, what you liked, what you hated. A supermarket job counts. If you picked \"none yet\", tell us what you''ve been doing instead."}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ============ Section 2: How you operate ============
INSERT INTO public.questions (id, section_id, type, label, required, allow_multiple, allow_other, order_num, min_selections, max_selections, config) VALUES
  ('a1a1a1a1-0002-4000-a000-000000000001', 'a1a1a1a1-0000-4000-a000-000000000002', 'multiple_choice', 'In a group, where do you usually find yourself?', true, false, false, 1, NULL, NULL,
   '{"choices": ["Energizing the room and connecting people", "Contributing when I have something real to add", "Observing first, acting once I get the picture", "It depends completely on the group"]}'::jsonb),
  ('a1a1a1a1-0002-4000-a000-000000000002', 'a1a1a1a1-0000-4000-a000-000000000002', 'multiple_choice', 'When you face a big decision, what do you actually do?', true, false, false, 2, NULL, NULL,
   '{"choices": ["Research everything until I''m sure", "Go with my gut and adjust later", "Talk it through with people I trust", "Put it off until I''m forced to choose"]}'::jsonb),
  ('a1a1a1a1-0002-4000-a000-000000000003', 'a1a1a1a1-0000-4000-a000-000000000002', 'multiple_choice', 'Structure or freedom?', true, false, false, 3, NULL, NULL,
   '{"choices": ["Give me clear instructions and a plan", "Give me the goal and freedom in how I get there", "A mix, depending on the task"]}'::jsonb),
  ('a1a1a1a1-0002-4000-a000-000000000004', 'a1a1a1a1-0000-4000-a000-000000000002', 'multiple_choice', 'How do you handle deadline pressure?', true, false, false, 4, NULL, NULL,
   '{"choices": ["I thrive on it, my best work happens under pressure", "I perform fine but prefer calm", "I get stressed and it shows", "I avoid it by starting early"]}'::jsonb),
  ('a1a1a1a1-0002-4000-a000-000000000005', 'a1a1a1a1-0000-4000-a000-000000000002', 'multiple_choice', 'How do you learn best?', true, true, false, 5, 1, 2,
   '{"choices": ["By doing and trying things", "Videos and tutorials", "Reading and taking notes", "Someone explaining it to me one-on-one", "Trial and error until it clicks"], "description": "Pick up to 2."}'::jsonb),
  ('a1a1a1a1-0002-4000-a000-000000000006', 'a1a1a1a1-0000-4000-a000-000000000002', 'multiple_choice', 'How do you deal with feedback or criticism?', true, false, false, 6, NULL, NULL,
   '{"choices": ["I actively look for it and use it", "I appreciate it but need a moment first", "I find it hard and can take it personally", "Depends entirely on who it comes from"]}'::jsonb),
  ('a1a1a1a1-0002-4000-a000-000000000007', 'a1a1a1a1-0000-4000-a000-000000000002', 'multiple_choice', 'In a team project, which role do you naturally take?', true, false, true, 7, NULL, NULL,
   '{"choices": ["The organizer who keeps everyone on track", "The ideas person", "The one who quietly gets the work done", "The peacemaker who keeps the vibe good", "The critical one who spots the problems"]}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ============ Section 3: What drives you ============
INSERT INTO public.questions (id, section_id, type, label, required, allow_multiple, allow_other, order_num, min_selections, max_selections, config) VALUES
  ('a1a1a1a1-0003-4000-a000-000000000001', 'a1a1a1a1-0000-4000-a000-000000000003', 'ranking', 'Rank what matters most in your (next) job', true, true, false, 1, NULL, NULL,
   '{"choices": ["**Learning & Growth** (getting better fast, building real skills)", "**Financial independence** (my own money, my own life)", "**Job security** (stability I can count on)", "**Doing something that matters** (impact on people or the world)", "**Freedom & flexibility** (control over my time and place)", "**Belonging & good colleagues** (people I actually like)", "**Status & recognition** (being seen as good at what I do)", "**Enjoying the day-to-day** (liking the actual work)"], "description": ""}'::jsonb),
  ('a1a1a1a1-0003-4000-a000-000000000002', 'a1a1a1a1-0000-4000-a000-000000000003', 'long_text', 'A year into your first serious job, what would make you say "this was a win"?', true, false, false, 2, NULL, NULL,
   '{"max_length": 600}'::jsonb),
  ('a1a1a1a1-0003-4000-a000-000000000003', 'a1a1a1a1-0000-4000-a000-000000000003', 'multiple_choice', 'Where''s your head at with the job market right now?', true, false, false, 3, NULL, NULL,
   '{"choices": ["Honestly anxious, it feels stacked against my generation", "Frustrated, I do everything right and get nowhere", "Neutral, it is what it is", "Optimistic, I''ll find my way", "I haven''t really thought about it"]}'::jsonb),
  ('a1a1a1a1-0003-4000-a000-000000000004', 'a1a1a1a1-0000-4000-a000-000000000003', 'multiple_choice', 'And AI? How do you feel about it and work?', true, false, false, 4, NULL, NULL,
   '{"choices": ["Worried it will eat the jobs I''m aiming for", "Confused about what it means for me", "Curious, I want to use it to get ahead", "I already use it daily", "Indifferent"]}'::jsonb),
  ('a1a1a1a1-0003-4000-a000-000000000005', 'a1a1a1a1-0000-4000-a000-000000000003', 'long_text', 'What''s your biggest worry about starting your career?', true, false, false, 5, NULL, NULL,
   '{"max_length": 600, "description": "Be honest. This is what lets us give you straight answers instead of generic advice."}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ============ Section 4: Interests and strengths ============
INSERT INTO public.questions (id, section_id, type, label, required, allow_multiple, allow_other, order_num, min_selections, max_selections, config) VALUES
  ('a1a1a1a1-0004-4000-a000-000000000001', 'a1a1a1a1-0000-4000-a000-000000000004', 'short_text', 'Which subjects did you actually enjoy in school or your studies?', true, false, false, 1, NULL, NULL,
   '{"description": "The ones you''d pick again, not the ones you were told were useful."}'::jsonb),
  ('a1a1a1a1-0004-4000-a000-000000000002', 'a1a1a1a1-0000-4000-a000-000000000004', 'long_text', 'What do friends or classmates come to you for?', true, false, false, 2, NULL, NULL,
   '{"max_length": 600, "description": "The thing people naturally ask your help with. Fixing stuff, advice, planning, explaining, calming people down..."}'::jsonb),
  ('a1a1a1a1-0004-4000-a000-000000000003', 'a1a1a1a1-0000-4000-a000-000000000004', 'long_text', 'What''s the thing you''re most proud of making, doing, or organizing?', true, false, false, 3, NULL, NULL,
   '{"max_length": 600, "description": "A school project, a shift you ran, something you built or posted online, an event, a personal record. Anything counts."}'::jsonb),
  ('a1a1a1a1-0004-4000-a000-000000000004', 'a1a1a1a1-0000-4000-a000-000000000004', 'interests_hobbies', 'List personal interests or hobbies that matter to you', true, false, false, 4, NULL, NULL,
   '{"description": "Provide **up to 3** (e.g. gaming, football, thrifting, cooking, editing videos, sneakers, reading...)"}'::jsonb),
  ('a1a1a1a1-0004-4000-a000-000000000005', 'a1a1a1a1-0000-4000-a000-000000000004', 'multiple_choice', 'How are you with technology?', true, false, false, 5, NULL, NULL,
   '{"choices": ["I can make tech do things most people can''t (coding, editing, automating)", "I learn any new tool fast", "I''m fine with everyday apps and tools", "I prefer to keep tech simple"]}'::jsonb),
  ('a1a1a1a1-0004-4000-a000-000000000006', 'a1a1a1a1-0000-4000-a000-000000000004', 'multiple_choice', 'Which of these sound most like you?', true, true, false, 6, 2, 4,
   '{"choices": ["Making or building things", "Analyzing and figuring things out", "Helping or teaching people", "Selling or convincing", "Organizing and planning", "Creating content or design", "Working with my hands", "Working with numbers", "Caring for people or animals", "Being outdoors and on the move"], "description": "Pick 2 to 4."}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ============ Section 5: Where you work best ============
INSERT INTO public.questions (id, section_id, type, label, required, allow_multiple, allow_other, order_num, min_selections, max_selections, config) VALUES
  ('a1a1a1a1-0005-4000-a000-000000000001', 'a1a1a1a1-0000-4000-a000-000000000005', 'multiple_choice', 'Your ideal team setup?', true, false, false, 1, NULL, NULL,
   '{"choices": ["A buzzing environment with lots of people", "A small, tight-knit team", "Mostly independent with regular check-ins", "A mix"]}'::jsonb),
  ('a1a1a1a1-0005-4000-a000-000000000002', 'a1a1a1a1-0000-4000-a000-000000000005', 'multiple_choice', 'Desk, remote, or on your feet?', true, false, false, 2, NULL, NULL,
   '{"choices": ["At a desk in an office", "Remote, from wherever", "Hands-on, on my feet or on location", "A mix"]}'::jsonb),
  ('a1a1a1a1-0005-4000-a000-000000000003', 'a1a1a1a1-0000-4000-a000-000000000005', 'multiple_choice', 'What pace suits you?', true, false, false, 3, NULL, NULL,
   '{"choices": ["Fast and varied, new things every day", "Steady with clear routines", "Waves: intense sprints, then calm"]}'::jsonb),
  ('a1a1a1a1-0005-4000-a000-000000000004', 'a1a1a1a1-0000-4000-a000-000000000005', 'multiple_choice', 'How much guidance do you want from a manager at the start?', true, false, false, 4, NULL, NULL,
   '{"choices": ["A lot, teach me the ropes properly", "Regular check-ins but room to try things", "Minimal, let me figure it out"]}'::jsonb),
  ('a1a1a1a1-0005-4000-a000-000000000005', 'a1a1a1a1-0000-4000-a000-000000000005', 'multiple_choice', 'Any dealbreakers?', false, true, true, 5, NULL, 3,
   '{"choices": ["Rigid 9-to-5 with zero flexibility", "Constant overtime pressure", "Cut-throat competition between colleagues", "Boring, repetitive work", "No path to grow", "A long commute", "Formal dress codes and stiff culture"], "description": "Optional. Pick up to 3."}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ============ Section 6: Practical reality ============
INSERT INTO public.questions (id, section_id, type, label, required, allow_multiple, allow_other, order_num, min_selections, max_selections, config) VALUES
  ('a1a1a1a1-0006-4000-a000-000000000001', 'a1a1a1a1-0000-4000-a000-000000000006', 'multiple_choice', 'Would you move for the right job?', true, false, false, 1, NULL, NULL,
   '{"choices": ["Yes, anywhere", "Within my country", "Only near where I live now", "I want to stay where I am"]}'::jsonb),
  ('a1a1a1a1-0006-4000-a000-000000000002', 'a1a1a1a1-0000-4000-a000-000000000006', 'multiple_choice', 'Salary versus learning: where are you?', true, false, false, 2, NULL, NULL,
   '{"choices": ["Max salary now, I need the money", "A fair balance", "I''d take less pay for real growth", "Income barely matters to me yet"]}'::jsonb),
  ('a1a1a1a1-0006-4000-a000-000000000003', 'a1a1a1a1-0000-4000-a000-000000000006', 'multiple_choice', 'Would you take a "foot in the door" job that isn''t the dream but leads toward it?', true, false, false, 3, NULL, NULL,
   '{"choices": ["Absolutely, in is in", "Yes, if the path from A to B is clear", "Reluctantly", "No, I''m aiming straight at what I want"]}'::jsonb),
  ('a1a1a1a1-0006-4000-a000-000000000004', 'a1a1a1a1-0000-4000-a000-000000000006', 'multiple_choice', 'Open to more studying or certifications?', true, false, false, 4, NULL, NULL,
   '{"choices": ["Yes, even a full degree if it''s worth it", "Short courses and certificates, sure", "Only learning on the job", "I''m done with studying"]}'::jsonb),
  ('a1a1a1a1-0006-4000-a000-000000000005', 'a1a1a1a1-0000-4000-a000-000000000006', 'dropdown', 'When do you want (or need) to be working?', true, false, false, 5, NULL, NULL,
   '{"choices": ["As soon as possible", "Within 3 months", "Within a year", "I''m still studying, planning ahead"]}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ============ Section 7: Looking ahead ============
INSERT INTO public.questions (id, section_id, type, label, required, allow_multiple, allow_other, order_num, min_selections, max_selections, config) VALUES
  ('a1a1a1a1-0007-4000-a000-000000000001', 'a1a1a1a1-0000-4000-a000-000000000007', 'long_text', 'What does a "serious job" actually mean to you?', true, false, false, 1, NULL, NULL,
   '{"max_length": 600}'::jsonb),
  ('a1a1a1a1-0007-4000-a000-000000000002', 'a1a1a1a1-0000-4000-a000-000000000007', 'long_text', 'Where do you hope to be in two years?', true, false, false, 2, NULL, NULL,
   '{"max_length": 600, "description": "Loose is fine. A vibe, a salary, a title, a lifestyle."}'::jsonb),
  ('a1a1a1a1-0007-4000-a000-000000000003', 'a1a1a1a1-0000-4000-a000-000000000007', 'multiple_choice', 'What do you want to get out of Cairnly?', true, true, false, 3, 1, NULL,
   '{"choices": ["Concrete career directions that fit me", "An honest take on my strengths", "A realistic plan to actually get hired", "Understanding what AI means for my options", "Clarity, because my head is a mess"], "description": "Select everything that applies."}'::jsonb),
  ('a1a1a1a1-0007-4000-a000-000000000004', 'a1a1a1a1-0000-4000-a000-000000000007', 'long_text', 'Anything else we should know?', false, false, false, 4, NULL, NULL,
   '{"max_length": 600, "description": "Optional. Context, constraints, a hunch about yourself, anything."}'::jsonb)
ON CONFLICT (id) DO NOTHING;
