-- Phase 2: the global exercise seed. Data only, no table change, no Dexie bump.
--
-- Every row is global: user_id is null. Each id is a fixed v4 UUID. Phase 3 and every
-- workout_sets row point at these ids, so they are permanent. Never change one.
--
-- on conflict (id) do nothing makes a rerun add no row.

insert into public.exercises (id, user_id, name, muscle_group)
values
  ('c9fca3c0-08f3-4abe-aed2-50424b8342fc', null, 'Bench Press', 'chest'),
  ('d7d68191-baf3-48e7-a1d4-35ff3698edfd', null, 'Incline Bench Press', 'chest'),
  ('36339683-c2c6-4aae-afed-00014862cd7a', null, 'Incline Dumbbell Press', 'chest'),
  ('d38fd0fa-86cc-40be-90b9-19387afbc6a5', null, 'Dumbbell Fly', 'chest'),
  ('5b04c06f-2475-454e-b49c-df29a89c607a', null, 'Cable Crossover', 'chest'),
  ('bbf8f9b9-8a91-45ad-853e-ab3179b1ad5e', null, 'Push-Up', 'chest'),
  ('2c321278-8949-45d8-9283-da4025e7b674', null, 'Deadlift', 'back'),
  ('8e7bfa97-3837-4259-bd85-c93f7d5db288', null, 'Lat Pulldown', 'back'),
  ('0155007a-a7cf-48ac-9821-75863fe97566', null, 'Pull-Up', 'back'),
  ('54bdc384-6c7a-4d7a-ba48-66cee7f1c47e', null, 'Seated Cable Row', 'back'),
  ('64bdbfac-62e1-40de-b344-231d513a37cf', null, 'Barbell Row', 'back'),
  ('3be1f0ce-8dad-4081-ac95-cb4fef4885fc', null, 'Dumbbell Row', 'back'),
  ('5caf18b3-c913-4d5f-8470-776b5d1bd34d', null, 'Back Squat', 'legs'),
  ('afeec7be-9e32-4329-85e3-88b70d6d1069', null, 'Leg Press', 'legs'),
  ('05bdb8c1-0eaf-4c63-8979-2be65821412a', null, 'Romanian Deadlift', 'legs'),
  ('3822cbde-0c0f-44c8-a492-5e3cb2edb652', null, 'Leg Extension', 'legs'),
  ('c3d68d1a-8605-4d5a-8be5-9a75f9ab4e64', null, 'Leg Curl', 'legs'),
  ('37d3c13a-b758-4616-a06b-2e5e99a5a748', null, 'Walking Lunge', 'legs'),
  ('8431d6c1-ad85-41a7-88c3-089124f1155a', null, 'Standing Calf Raise', 'legs'),
  ('3ff631c7-47a0-496f-959f-afe1c216976a', null, 'Overhead Press', 'shoulders'),
  ('babbaff3-105b-4570-9d24-c4ee05b5b58b', null, 'Dumbbell Shoulder Press', 'shoulders'),
  ('5e51dd59-aa9c-4be7-87f6-4f38bb668b9f', null, 'Lateral Raise', 'shoulders'),
  ('578e94a2-6b2b-4ba7-b374-f75ec2ad84dc', null, 'Rear Delt Fly', 'shoulders'),
  ('a46b0c86-8132-4878-be74-6ae3cd5ad53b', null, 'Face Pull', 'shoulders'),
  ('85e0cc77-f328-47c9-adbb-28ce46df82f3', null, 'Barbell Curl', 'arms'),
  ('10ce88f1-283f-40d3-be29-c144323217a1', null, 'Dumbbell Curl', 'arms'),
  ('afaa7d25-0e36-440e-a6ce-a312f593e67f', null, 'Hammer Curl', 'arms'),
  ('64ce48ba-2f29-4e7e-b155-f5a9043fa16d', null, 'Triceps Pushdown', 'arms'),
  ('c1da4f05-9fee-47ea-beb3-1c11eed993fe', null, 'Overhead Triceps Extension', 'arms'),
  ('8276fbcc-fec4-4186-bf67-56c2fadffcb9', null, 'Skull Crusher', 'arms'),
  ('4fa9a175-da08-41ab-afcb-5e0146c5375b', null, 'Decline Sit-Up', 'core'),
  ('a68accdf-8b1e-49af-ad93-86adb8afbd01', null, 'Hanging Leg Raise', 'core'),
  ('fc894c6f-3244-413e-b4bd-c21c5a23f303', null, 'Cable Crunch', 'core'),
  ('b991a77e-38eb-4436-b96b-43d4195bfbfe', null, 'Russian Twist', 'core'),
  ('a09160e9-44e3-4c31-99a9-a3aa850f6455', null, 'Ab Wheel Rollout', 'core'),
  ('12a62468-f421-4093-97d6-a6da02408224', null, 'Treadmill', 'cardio'),
  ('671f6351-d88d-48d8-87a3-d289dad4838c', null, 'Stationary Bike', 'cardio'),
  ('a79f89ae-a362-49f2-bcef-e510d29bc542', null, 'Rowing Machine', 'cardio'),
  ('2241244c-fac5-4130-b9e2-2b7577bd7e34', null, 'Elliptical', 'cardio'),
  ('24a0ba01-ac9e-4ddc-a5cf-12f7debffa20', null, 'Stair Climber', 'cardio')
on conflict (id) do nothing;
