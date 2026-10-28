# Dimi's Lessons

A quiet studio for private lessons. What was studied, what is due, and what is paid live in one place, written once and visible to the people who need them.

![Dimi in a sunlit studio, paper notebooks lifting into loose lesson pages](docs/images/studio-hero.jpg)

## Why it exists

I have run this tutoring practice on paper for four years. The notebooks worked. They also lived in one bag, so a parent, a student, and I were rarely looking at the same page.

This is that practice, digitized, so I can help myself, my students, and their parents. It is also for other private tutoring relationships that want the same thing: organise the work in a clean, subtle way, and keep it transparent and up to date.

## What stays in the open

**Today.** Who is next, then one note after class: the material, and the homework.

**Money.** A price, a payment, a prepaid pack. Open balances and packs running low sit where they can be seen, without a search through old messages.

**The family.** A parent can read the lessons and leave feedback. The lesson record stays as the teacher wrote it.

**The student.** What was studied, and the homework waiting, under their own sign-in.

A parent can register a student. Nothing is opened until the teacher confirms it. The studio speaks English and Bulgarian.

![After class, one card on the table between teacher and student](docs/images/after-class.jpg)

![Teacher, parent, and student reading the same open notebook](docs/images/family-clear.jpg)

## A ledger that stays quiet

![Dimi writing in a small stack of lesson cards, an envelope beside them](docs/images/quiet-ledger.jpg)

Payments belong with the lessons, not in a separate spreadsheet. When everyone is up to date, the page says so and stays out of the way.

## For other tutors, if they want it

![Dimi passing a small stack of notebooks to another tutor](docs/images/shared-studio.jpg)

The rooms are simple: a teacher, the families they teach, and the students. Another private tutor can use the same ones — today, money, signups, feedback — without turning the practice into a back office.

## Run it

Create a Supabase project in an EU region. In Authentication, set the site URL to `https://dims-lessons.vercel.app` and add `https://dims-lessons.vercel.app/**` as a redirect URL. Apply [supabase/migrations/0001_init.sql](supabase/migrations/0001_init.sql) in the SQL editor. Turn on database backups before any real names are stored. Create the teacher user in Authentication with the same email as `TEACHER_EMAIL`. The profile row is created on the first sign-in. The studio starts empty.

```bash
cp .env.example .env.local
npm install
npm run dev
```

`SUPABASE_SERVICE_ROLE_KEY` stays on the server. It is used for student PIN sessions and for inviting a parent. Parents and the teacher sign in through Supabase. A student signs in with the name and PIN set by the teacher, and that session cannot read payments or feedback.

For the hosted studio, deploy this Next app to Vercel with the same environment variables. `NEXT_PUBLIC_SITE_URL` is `https://dims-lessons.vercel.app`, which matches the Supabase site URL, and parent email links use `https://dims-lessons.vercel.app/en/auth/confirm` or the Bulgarian equivalent. Both sit under the redirect `https://dims-lessons.vercel.app/**`. Point Supabase mail at your own domain before inviting more than one family.
