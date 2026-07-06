-- Cairnly Encore survey: new survey for pensioners / pre-retirees (cairnly.io/encore).
-- Fully additive: brand-new survey id + section ids + question ids (b2b2b2b2-... scheme).
-- The live pro survey (00000000-...-0001, ids 11111111.../22222222/...) and the starter
-- survey (00000000-...-0002, ids a1a1a1a1-...) are untouched, so the production n8n
-- chains can never receive or misread encore answers.
-- Handoff: handoff/Pensioner/pensioner-flavor-handoff.md

-- ============ Survey ============
INSERT INTO public.surveys (id, title)
VALUES ('00000000-0000-0000-0000-000000000003', 'Encore - Post-Career Direction - 2026 v1 EN')
ON CONFLICT (id) DO NOTHING;

-- ============ Sections ============
INSERT INTO public.survey_sections (id, survey_id, title, description, order_num) VALUES
  ('b2b2b2b2-0000-4000-a000-000000000001', '00000000-0000-0000-0000-000000000003', 'Getting to know you', 'The basics, so your results fit the life you actually have.', 1),
  ('b2b2b2b2-0000-4000-a000-000000000002', '00000000-0000-0000-0000-000000000003', 'The career you had', 'Decades of evidence. We will use it properly, then set it aside.', 2),
  ('b2b2b2b2-0000-4000-a000-000000000003', '00000000-0000-0000-0000-000000000003', 'How you operate now', 'Not who you were at 45. Who you are now.', 3),
  ('b2b2b2b2-0000-4000-a000-000000000004', '00000000-0000-0000-0000-000000000003', 'What matters now', 'Different stage, different scoreboard.', 4),
  ('b2b2b2b2-0000-4000-a000-000000000005', '00000000-0000-0000-0000-000000000003', 'Where you thrive', 'The setting for whatever comes next.', 5),
  ('b2b2b2b2-0000-4000-a000-000000000006', '00000000-0000-0000-0000-000000000003', 'Practical reality', 'Honesty here keeps the advice honest.', 6),
  ('b2b2b2b2-0000-4000-a000-000000000007', '00000000-0000-0000-0000-000000000003', 'Looking ahead', 'Say it straight. We will do the same.', 7)
ON CONFLICT (id) DO NOTHING;

-- ============ Section 1: Getting to know you ============
INSERT INTO public.questions (id, section_id, type, label, required, allow_multiple, allow_other, order_num, min_selections, max_selections, config) VALUES
  ('b2b2b2b2-0001-4000-a000-000000000001', 'b2b2b2b2-0000-4000-a000-000000000001', 'short_text', 'Your name', true, false, false, 1, NULL, NULL,
   '{"description": "First and last name"}'::jsonb),
  ('b2b2b2b2-0001-4000-a000-000000000002', 'b2b2b2b2-0000-4000-a000-000000000001', 'number', 'Your age', true, false, false, 2, NULL, NULL,
   '{}'::jsonb),
  ('b2b2b2b2-0001-4000-a000-000000000003', 'b2b2b2b2-0000-4000-a000-000000000001', 'dropdown', 'What region are you based?', true, false, false, 3, NULL, NULL,
   '{"choices": ["Northern and Western Europe", "Southern and Eastern Europe", "United Kingdom (London)", "United Kingdom (Other)", "United States (High-Cost Regions)", "United States (Average-Cost Regions)", "United States (Lower-Cost Regions)", "Canada", "Australia and New Zealand", "Switzerland"], "description": "If you are moving somewhere for this next stage, pick that region."}'::jsonb),
  ('b2b2b2b2-0001-4000-a000-000000000004', 'b2b2b2b2-0000-4000-a000-000000000001', 'multiple_choice', 'Where are you in the transition?', true, false, true, 4, NULL, NULL,
   '{"choices": ["Still working, retirement is on the horizon", "Working, but winding down (fewer days or a lighter role)", "Recently stopped (less than a year ago)", "Stopped a while ago (more than a year)", "Semi-retired, already doing bits and pieces"]}'::jsonb),
  ('b2b2b2b2-0001-4000-a000-000000000005', 'b2b2b2b2-0000-4000-a000-000000000001', 'dropdown', 'When does (or did) the big change happen?', true, false, false, 5, NULL, NULL,
   '{"choices": ["More than 2 years away", "Within 1 to 2 years", "Within a year", "It just happened", "More than a year ago"]}'::jsonb),
  ('b2b2b2b2-0001-4000-a000-000000000006', 'b2b2b2b2-0000-4000-a000-000000000001', 'multiple_choice', 'What is the highest level of education you have completed?', true, false, false, 6, NULL, NULL,
   '{"choices": ["No formal education", "High school diploma or equivalent", "Associate''s degree (e.g., technical college or vocational training)", "Bachelor''s degree", "Master''s degree", "Doctorate or professional degree (e.g., PhD, MD, JD)"]}'::jsonb),
  ('b2b2b2b2-0001-4000-a000-000000000007', 'b2b2b2b2-0000-4000-a000-000000000001', 'short_text', 'What did you study?', false, false, false, 7, NULL, NULL,
   '{"description": "Field or specialization, if applicable. Optional."}'::jsonb),
  ('b2b2b2b2-0001-4000-a000-000000000008', 'b2b2b2b2-0000-4000-a000-000000000001', 'long_text', 'Who or what shapes your week right now?', false, false, false, 8, NULL, NULL,
   '{"max_length": 600, "description": "Optional. Partner, grandchildren, care duties, travel plans, the garden. Whatever structures your time today."}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ============ Section 2: The career you had ============
INSERT INTO public.questions (id, section_id, type, label, required, allow_multiple, allow_other, order_num, min_selections, max_selections, config) VALUES
  ('b2b2b2b2-0002-4000-a000-000000000001', 'b2b2b2b2-0000-4000-a000-000000000002', 'career_history', 'What were the defining roles of your career?', true, false, false, 1, NULL, NULL,
   '{"description": "Your most recent or most defining roles. No need for the full CV, the highlights are enough.", "companySizeOptions": ["Micro (1-10)", "Small (11-50)", "Medium (51-200)", "Large (201-1000)", "Enterprise (1000-5000)", "Multi National (5000+)", "Own Company"], "companyCultureOptions": ["Startup / Scale-up", "Corporate", "Mid-Market", "Agency / Consultancy", "Boutique / Niche", "Nonprofit / Social Impact", "Public Sector / Gov", "Solo / Freelance", "Small Business Owner (up to 5 FTE)"]}'::jsonb),
  ('b2b2b2b2-0002-4000-a000-000000000002', 'b2b2b2b2-0000-4000-a000-000000000002', 'career_happiness', 'How happy were you in each of these roles?', true, false, false, 2, NULL, NULL,
   '{"maxValue": 10, "minValue": 1, "description": "Rate your happiness (1-10) and explain what about the role''s responsibilities and the work itself affected your satisfaction - not the company culture, specific people, or circumstances.", "linkedQuestionId": "b2b2b2b2-0002-4000-a000-000000000001"}'::jsonb),
  ('b2b2b2b2-0002-4000-a000-000000000003', 'b2b2b2b2-0000-4000-a000-000000000002', 'number', 'How many years did you work in total?', true, false, false, 3, NULL, NULL,
   '{"description": "A rough number is fine."}'::jsonb),
  ('b2b2b2b2-0002-4000-a000-000000000004', 'b2b2b2b2-0000-4000-a000-000000000002', 'skills_achievements', 'Skills, Achievements & Languages', true, false, false, 4, NULL, NULL,
   '{"description": "What you were good at and what you are proud of. This is the raw material for what comes next.", "languages_other": ["Russian", "Portuguese", "Bengali", "Japanese", "Korean", "Italian", "Turkish", "Swedish", "Polish", "Vietnamese", "Indonesian", "Thai", "Greek", "Hebrew", "Ukrainian", "Persian (Farsi)", "Urdu", "Punjabi", "Tamil", "Telugu", "Marathi", "Gujarati", "Malay", "Filipino (Tagalog)", "Romanian", "Czech", "Hungarian", "Norwegian", "Danish", "Finnish", "Swahili", "Afrikaans", "Catalan", "Slovak", "Bulgarian", "Croatian", "Serbian", "Lithuanian", "Latvian", "Estonian"], "languages_presets": ["English", "Mandarin Chinese", "Hindi", "Spanish", "French", "Arabic", "Dutch", "German"], "languages_proficiency_levels": [{"label": "Native", "value": "native"}, {"label": "Fluent", "value": "fluent"}, {"label": "Conversational", "value": "conversational"}, {"label": "Basic", "value": "basic"}]}'::jsonb),
  ('b2b2b2b2-0002-4000-a000-000000000005', 'b2b2b2b2-0000-4000-a000-000000000002', 'long_text', 'What were you known for?', true, false, false, 5, NULL, NULL,
   '{"max_length": 600, "description": "The reputation you had. The thing colleagues would say about you when you were not in the room."}'::jsonb),
  ('b2b2b2b2-0002-4000-a000-000000000006', 'b2b2b2b2-0000-4000-a000-000000000002', 'long_text', 'What will you absolutely NOT miss?', true, false, false, 6, NULL, NULL,
   '{"max_length": 600, "description": "Be specific. Meetings, politics, targets, commuting, being on call..."}'::jsonb),
  ('b2b2b2b2-0002-4000-a000-000000000007', 'b2b2b2b2-0000-4000-a000-000000000002', 'long_text', 'And what did you secretly love, even if you rarely said so?', true, false, false, 7, NULL, NULL,
   '{"max_length": 600, "description": "The part of the work you would have done for free. There is usually one."}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ============ Section 3: How you operate now ============
INSERT INTO public.questions (id, section_id, type, label, required, allow_multiple, allow_other, order_num, min_selections, max_selections, config) VALUES
  ('b2b2b2b2-0003-4000-a000-000000000001', 'b2b2b2b2-0000-4000-a000-000000000003', 'multiple_choice', 'When is your energy at its best these days?', true, false, false, 1, NULL, NULL,
   '{"choices": ["Mornings, sharp and early", "Middle of the day", "It varies day to day", "Most of the day, energy is not my problem"]}'::jsonb),
  ('b2b2b2b2-0003-4000-a000-000000000002', 'b2b2b2b2-0000-4000-a000-000000000003', 'multiple_choice', 'How do social interactions affect your energy now?', true, false, false, 2, NULL, NULL,
   '{"choices": ["Energized (I thrive on people)", "Somewhat energized (I enjoy it, with a limit)", "Somewhat drained (fine, but I need quiet afterwards)", "Drained (I guard my alone time)"]}'::jsonb),
  ('b2b2b2b2-0003-4000-a000-000000000003', 'b2b2b2b2-0000-4000-a000-000000000003', 'multiple_choice', 'Structure or freedom, at this stage?', true, false, false, 3, NULL, NULL,
   '{"choices": ["Real structure: fixed days and standing commitments", "Some structure: a rhythm without a cage", "Mostly freedom: I commit per project or season", "Total freedom: I have earned it"]}'::jsonb),
  ('b2b2b2b2-0003-4000-a000-000000000004', 'b2b2b2b2-0000-4000-a000-000000000003', 'multiple_choice', 'How is your appetite for learning new things?', true, false, false, 4, NULL, NULL,
   '{"choices": ["Strong, I actively want to master something new", "Selective, for the right subject", "Modest, I would rather apply what I already know", "Honestly low, and that is fine"]}'::jsonb),
  ('b2b2b2b2-0003-4000-a000-000000000005', 'b2b2b2b2-0000-4000-a000-000000000003', 'multiple_choice', 'Working with people decades younger than you: how does that sit?', true, false, false, 5, NULL, NULL,
   '{"choices": ["Genuinely energizing, I like their pace", "Fine, as long as there is mutual respect", "A bit awkward, but workable", "I would rather work with peers"]}'::jsonb),
  ('b2b2b2b2-0003-4000-a000-000000000006', 'b2b2b2b2-0000-4000-a000-000000000003', 'multiple_choice', 'How do you handle feedback at this point in life?', true, false, false, 6, NULL, NULL,
   '{"choices": ["Still hungry for it", "Open to it, if it is delivered like an adult", "I take it, but my ego has opinions", "Frankly, I am done being graded"]}'::jsonb),
  ('b2b2b2b2-0003-4000-a000-000000000007', 'b2b2b2b2-0000-4000-a000-000000000003', 'multiple_choice', 'Which of these do you recognize in yourself?', true, true, true, 7, NULL, NULL,
   '{"choices": ["I can be set in my ways", "I underestimate what I know", "I overcommit and then resent it", "I need to be needed", "Impatience with slow processes", "I dismiss new tools too quickly", "I find it hard to say no", "None of these"], "description": "Select all that apply. Honesty beats polish here.", "exclusive_choices": ["None of these"]}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ============ Section 4: What matters now ============
INSERT INTO public.questions (id, section_id, type, label, required, allow_multiple, allow_other, order_num, min_selections, max_selections, config) VALUES
  ('b2b2b2b2-0004-4000-a000-000000000001', 'b2b2b2b2-0000-4000-a000-000000000004', 'ranking', 'Rank what matters most in this next stage', true, true, false, 1, NULL, NULL,
   '{"choices": ["**Purpose & contribution** (work that means something to someone)", "**Staying sharp** (keeping the mind engaged and challenged)", "**Social connection** (people, belonging, being part of something)", "**Structure & routine** (a reason to get up and a rhythm to the week)", "**Recognition & being valued** (expertise that still counts)", "**Income top-up** (meaningful money on top of the pension)", "**Freedom for travel & family** (protecting the flexible life)", "**Enjoyment of the work itself** (doing things I actually like doing)"], "description": ""}'::jsonb),
  ('b2b2b2b2-0004-4000-a000-000000000002', 'b2b2b2b2-0000-4000-a000-000000000004', 'long_text', 'What does a genuinely good year look like at this stage?', true, false, false, 2, NULL, NULL,
   '{"max_length": 600, "description": "Not a bucket list. An ordinary good year. What is in it?"}'::jsonb),
  ('b2b2b2b2-0004-4000-a000-000000000003', 'b2b2b2b2-0000-4000-a000-000000000004', 'multiple_choice', 'What do you fear most about this stage?', true, true, true, 3, NULL, 2,
   '{"choices": ["Becoming irrelevant", "Boredom and empty days", "Losing the identity my work gave me", "Losing social contact", "Going soft without a reason to stay sharp", "My partner and I driving each other mad", "Honestly nothing, I am ready"], "description": "Pick up to 2. This is between you and the report.", "exclusive_choices": ["Honestly nothing, I am ready"], "max_selections": 2}'::jsonb),
  ('b2b2b2b2-0004-4000-a000-000000000004', 'b2b2b2b2-0000-4000-a000-000000000004', 'multiple_choice', 'The pace of technology and AI: how does it feel from where you sit?', true, false, false, 4, NULL, NULL,
   '{"choices": ["Exciting, I want to stay in the game", "Manageable, I keep up where it matters", "Uncomfortable, the world moves faster than I like", "Irrelevant to what I want next"]}'::jsonb),
  ('b2b2b2b2-0004-4000-a000-000000000005', 'b2b2b2b2-0000-4000-a000-000000000004', 'interests_hobbies', 'List personal interests or hobbies that matter to you', true, false, false, 5, NULL, NULL,
   '{"description": "Provide **up to 3** (e.g. sailing, gardening, history, bridge, photography, wine, grandkids'' football club...)"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ============ Section 5: Where you thrive ============
INSERT INTO public.questions (id, section_id, type, label, required, allow_multiple, allow_other, order_num, min_selections, max_selections, config) VALUES
  ('b2b2b2b2-0005-4000-a000-000000000001', 'b2b2b2b2-0000-4000-a000-000000000005', 'multiple_choice', 'How many hours a week do you actually want to commit?', true, false, false, 1, NULL, NULL,
   '{"choices": ["Under 8 hours", "8 to 16 hours", "16 to 24 hours", "24 to 32 hours", "Depends entirely on the season or project"]}'::jsonb),
  ('b2b2b2b2-0005-4000-a000-000000000002', 'b2b2b2b2-0000-4000-a000-000000000005', 'multiple_choice', 'In person, remote, or both?', true, false, false, 2, NULL, NULL,
   '{"choices": ["Mostly in person, the social part is the point", "Mostly remote, I value the freedom", "A real mix", "Depends on the work"]}'::jsonb),
  ('b2b2b2b2-0005-4000-a000-000000000003', 'b2b2b2b2-0000-4000-a000-000000000005', 'multiple_choice', 'Leading, contributing, or advising?', true, false, false, 3, NULL, NULL,
   '{"choices": ["Leading, I still like being in charge", "Contributing, meaningful work without the politics", "Advising, my judgment is the product", "Mentoring, developing people one on one", "A blend, depending on the setting"]}'::jsonb),
  ('b2b2b2b2-0005-4000-a000-000000000004', 'b2b2b2b2-0000-4000-a000-000000000005', 'multiple_choice', 'Which environments are you simply done with?', false, true, true, 4, NULL, 3,
   '{"choices": ["Corporate politics and steering committees", "Targets and performance reviews", "Open-plan offices", "Rigid schedules", "Being managed by process instead of sense", "Travel-heavy work", "High-stakes pressure cookers"], "description": "Optional. Pick up to 3.", "max_selections": 3}'::jsonb),
  ('b2b2b2b2-0005-4000-a000-000000000005', 'b2b2b2b2-0000-4000-a000-000000000005', 'multiple_choice', 'How social should the work itself be?', true, false, false, 5, NULL, NULL,
   '{"choices": ["Highly social, lots of people contact", "Regular contact with a familiar group", "Occasional contact, mostly independent work", "As little as possible"]}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ============ Section 6: Practical reality ============
INSERT INTO public.questions (id, section_id, type, label, required, allow_multiple, allow_other, order_num, min_selections, max_selections, config) VALUES
  ('b2b2b2b2-0006-4000-a000-000000000001', 'b2b2b2b2-0000-4000-a000-000000000006', 'multiple_choice', 'Where does income from this next stage sit for you?', true, false, false, 1, NULL, NULL,
   '{"choices": ["Not a factor, I am financially set", "Nice to have, it should pay something reasonable", "Needed, it has to meaningfully supplement my pension"], "description": "Nobody sees this but the model. Honesty here changes the advice."}'::jsonb),
  ('b2b2b2b2-0006-4000-a000-000000000002', 'b2b2b2b2-0000-4000-a000-000000000006', 'multiple_choice', 'How mobile are you?', true, false, false, 2, NULL, NULL,
   '{"choices": ["Fully mobile, happy to travel for the right thing", "Regional, within an hour or so", "Local, close to home", "Mostly home-based"]}'::jsonb),
  ('b2b2b2b2-0006-4000-a000-000000000003', 'b2b2b2b2-0000-4000-a000-000000000006', 'multiple_choice', 'Which commitments shape your calendar?', true, true, true, 3, NULL, NULL,
   '{"choices": ["Grandchildren", "Caring for a partner or family member", "Extended travel plans", "Volunteer commitments I intend to keep", "My own health rhythm", "A partner''s schedule", "None that constrain me"], "description": "Select all that apply.", "exclusive_choices": ["None that constrain me"]}'::jsonb),
  ('b2b2b2b2-0006-4000-a000-000000000004', 'b2b2b2b2-0000-4000-a000-000000000006', 'dropdown', 'When do you want this next thing to start?', true, false, false, 4, NULL, NULL,
   '{"choices": ["It already started, I am refining it", "As soon as possible", "Within 6 months", "Within a year", "Later, I am orienting first"]}'::jsonb),
  ('b2b2b2b2-0006-4000-a000-000000000005', 'b2b2b2b2-0000-4000-a000-000000000006', 'multiple_choice', 'What is your appetite for formal responsibility?', true, false, false, 5, NULL, NULL,
   '{"choices": ["Yes, formal roles with real accountability suit me", "Some, if the obligations are clearly bounded", "Influence without formal liability, please", "None, no formal obligations again"], "description": "Board and supervisory seats carry real legal liability and fixed obligations. Worth being honest about."}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ============ Section 7: Looking ahead ============
INSERT INTO public.questions (id, section_id, type, label, required, allow_multiple, allow_other, order_num, min_selections, max_selections, config) VALUES
  ('b2b2b2b2-0007-4000-a000-000000000001', 'b2b2b2b2-0000-4000-a000-000000000007', 'long_text', 'When you say you want to do something "meaningful", what do you actually mean?', true, false, false, 1, NULL, NULL,
   '{"max_length": 600, "description": "Meaningful to whom? Your family, your field, strangers, yourself? There is no wrong answer, but there is a vague one."}'::jsonb),
  ('b2b2b2b2-0007-4000-a000-000000000002', 'b2b2b2b2-0000-4000-a000-000000000007', 'long_text', 'What is the thing you always wanted to try but never had time for?', true, false, false, 2, NULL, NULL,
   '{"max_length": 600, "description": "Serious or not. This question has surprised people."}'::jsonb),
  ('b2b2b2b2-0007-4000-a000-000000000003', 'b2b2b2b2-0000-4000-a000-000000000007', 'multiple_choice', 'What do you want Cairnly to tell you straight?', true, true, false, 3, 1, NULL,
   '{"choices": ["What kinds of work actually fit me now", "What my experience is genuinely worth in today''s market", "An honest read on my personality, not flattery", "How to stay relevant in a world full of AI", "How to build a week that feels like a life, not a schedule", "Whether my own idea for this stage holds up"], "description": "Select everything that applies."}'::jsonb),
  ('b2b2b2b2-0007-4000-a000-000000000004', 'b2b2b2b2-0000-4000-a000-000000000007', 'long_text', 'Anything else we should know?', false, false, false, 4, NULL, NULL,
   '{"max_length": 600, "description": "Optional. Anything that did not fit the boxes."}'::jsonb)
ON CONFLICT (id) DO NOTHING;
