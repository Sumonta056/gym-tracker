insert into public.exercises (id, user_id, name, muscle_group)
values
  ('789b03e2-a4ab-4d83-ba28-6f454542d731', null, 'Flat Dumbbell Press', 'chest'),
  ('78115c1f-f854-4245-9db7-f984342aa949', null, 'Incline Dumbbell Fly', 'chest'),
  ('63409567-d074-45dc-a58b-486116691d07', null, 'Dumbbell Pullover', 'chest'),
  ('3f54ec95-289c-4690-b960-f09abbe3cba3', null, 'Dumbbell Overhead Extension', 'arms'),
  ('14beb627-006b-4fc2-ace3-de71e09dbbf7', null, 'Rope Pushdown', 'arms'),
  ('f19a18fa-a5b2-4db6-8402-ecea41d206fb', null, 'Straight Bar Pushdown', 'arms'),
  ('40c8ec57-5817-4709-afec-0e03d67a6d24', null, 'Bench Dips', 'arms'),
  ('c778aa8a-5d2c-4d0a-8d34-1b9ec95a4544', null, 'Machine Row', 'back'),
  ('a564989e-6aa8-442c-8959-a2eb6b43a875', null, 'Bent-Over Row', 'back'),
  ('3792015a-703b-4892-ad08-d9d0699525bd', null, 'Preacher Curl', 'arms'),
  ('dbfbd9d4-c01e-436c-ad3c-0ba46e881cab', null, 'Cable Reverse Curl', 'arms'),
  ('35e0e977-7287-492e-b8a2-6c13546a2140', null, 'Front Raise', 'shoulders'),
  ('f2abc3fd-9957-477c-b772-594a483bbd6d', null, 'Dumbbell Shrugs', 'back'),
  ('9662c0ce-f6e4-4a1d-b112-6fe81ed786cf', null, 'Squat', 'legs')
on conflict (id) do nothing;

alter table public.workout_sessions
  add column if not exists plan_ids text[]
    constraint workout_sessions_plan_ids_known
      check (
        cardinality(plan_ids) > 0
        and plan_ids <@ array['chest-triceps', 'back-biceps', 'shoulders', 'legs']::text[]
      );
