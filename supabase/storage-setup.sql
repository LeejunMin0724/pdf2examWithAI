-- PDF2Exam — Supabase Storage setup (run once)
--
-- Supabase Dashboard → SQL Editor → New query → 붙여넣고 Run
--
-- 왜 필요한가:
--   Vercel 함수는 요청 본문이 4.5MB를 넘으면 거부합니다. 그래서 4MB를 넘는 PDF는
--   브라우저 → Supabase Storage로 직접 올리고, 서버가 그 파일을 내려받아 텍스트를
--   추출합니다(/api/documents/import). 4MB 이하는 기존 업로드 경로를 그대로 씁니다.
--
-- 파일 경로 규칙: "<user id>/<document id>.pdf" — 폴더명이 곧 소유자라서
-- 아래 정책 한 줄로 "본인 폴더만" 접근이 보장됩니다. (게스트도 authenticated)

insert into storage.buckets (id, name, public, file_size_limit)
values ('pdf-uploads', 'pdf-uploads', false, 52428800) -- 50MB, 비공개
on conflict (id) do update set public = false, file_size_limit = 52428800;

drop policy if exists "pdf2exam upload own files" on storage.objects;
create policy "pdf2exam upload own files" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'pdf-uploads' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "pdf2exam read own files" on storage.objects;
create policy "pdf2exam read own files" on storage.objects
  for select to authenticated
  using (bucket_id = 'pdf-uploads' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "pdf2exam delete own files" on storage.objects;
create policy "pdf2exam delete own files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'pdf-uploads' and (storage.foldername(name))[1] = auth.uid()::text);
