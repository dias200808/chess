# Knightly

Knightly is a chess learning platform built for students, teachers, coaches, schools, and chess clubs.

It is not only "one more chess website". The main idea is education: a teacher can create a class, invite students, give chess tasks, and track how every student improves.

## Why I Built This

When I studied in my village, my chess teacher gave us many positions and puzzles on paper. I solved them, then he checked them by hand. It worked, but it was hard for one teacher to give personal tasks to everyone, check every answer, remember every mistake, and understand who needed what kind of training.

Knightly is my answer to that problem.

Instead of paper tasks, the teacher gets a dashboard. Students can solve puzzles, play games, complete lessons, and the teacher can see their activity, progress, mistakes, and weak topics. This makes chess training easier for a small village class, a school club, or a serious chess academy.

## Main Difference

Most chess sites are focused on individual play.

Knightly is focused on learning with a teacher.

Teachers can:

- create a teacher account;
- create classes;
- invite students;
- accept student requests;
- give assignments;
- monitor student activity;
- see solved puzzles and played games;
- open student game analysis;
- track ratings, puzzle progress, accuracy, and weak topics;
- use simple AI reports to understand what each student should train next.

Students can:

- create a student account;
- join a teacher class by code;
- solve puzzles;
- play chess;
- complete assignments;
- learn from interactive lessons;
- see their own progress.

## Features

- Online play for guests and account users
- Play with friend links
- Local chess board
- Bot games with difficulty levels
- Game history and PGN saving
- Analysis board with Stockfish support
- Puzzle training, Puzzle Rush, streaks, and puzzle rating
- Interactive Learn section with courses and lesson progress
- Teacher and student roles
- Classroom system with class codes
- Student join requests and teacher invitations
- Assignments and progress tracking
- Class leaderboard
- Student activity tracking
- Basic AI student reports
- Pro pricing page for normal players and teachers
- Supabase Auth and database schema
- Vercel-ready Next.js app

## Tech Stack

- Next.js
- React
- TypeScript
- Tailwind CSS
- Supabase
- chess.js
- react-chessboard
- Stockfish

## Getting Started

Install dependencies:

```bash
npm install
```

Run locally:

```bash
npm run dev
```

Open:

```txt
http://localhost:3000
```

## Supabase Setup

1. Create a Supabase project.
2. Open the Supabase SQL editor.
3. Run the SQL from `supabase/schema.sql`.
4. Copy `.env.example` to `.env.local`.
5. Add your Supabase keys:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

`SUPABASE_SERVICE_ROLE_KEY` must stay server-only. Never expose it in the browser.

## Build

```bash
npm run build
```

## Deploy To Vercel

Push the project to GitHub, import the repository in Vercel, and add the same Supabase environment variables in Vercel Project Settings.

## Git Commands

If the repository is already connected to GitHub:

```bash
git add .
git commit -m "Update Knightly chess education platform"
git push
```

If this is the first push:

```bash
git init
git add .
git commit -m "Initial Knightly chess education platform"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

## Vision

Knightly should help teachers spend less time checking paper and more time teaching.

The goal is simple: make chess learning clearer, more personal, and more accessible for every student, even in small places where one teacher has to help many kids at once.

# Chess Learning Platform

Это не просто обычный сайт для игры в шахматы.  
Это шахматная образовательная платформа для учеников и учителей.

## Главная идея

Главная идея проекта — помочь шахматным учителям удобнее работать с учениками: давать задания, отслеживать активность, проверять прогресс и понимать, над чем каждому ученику нужно работать.

Большинство шахматных платформ делают акцент на игре, задачах или анализе партий.  
Мой проект делает акцент на связи между учителем и учеником.

## Почему я сделал этот проект

Когда я учился в ауле, мой шахматный учитель давал нам много задач на бумаге.  
Мы решали их вручную, а потом учитель должен был проверять ответы каждого ученика.

Проблема была в том, что у одного учителя было много учеников.  
Ему было сложно:

- давать каждому ученику индивидуальные задания
- проверять все решенные задачи
- отслеживать, кто занимается активно
- понимать, кто реально прогрессирует
- видеть, какие ошибки делает каждый ученик
- подбирать задания под уровень каждого

Этот проект решает эту проблему.

## Чем проект отличается от других шахматных сайтов

Главное отличие проекта — система “учитель — ученик”.

Учитель может создать свой аккаунт, создать класс и добавить туда учеников.  
Ученики могут вступить в класс, решать задачи, играть партии, проходить обучение и улучшать свою игру.

Учитель может отслеживать:

- активность учеников
- решенные задачи
- сыгранные партии
- анализ партий
- ошибки и грубые ошибки
- рейтинг
- прогресс по урокам
- выполненные задания
- слабые темы каждого ученика

Благодаря этому учитель лучше понимает уровень каждого ученика и может давать более полезные задания.

## Основные функции

- шахматная доска с правильными ходами
- игра в шахматы
- шахматные задачи
- анализ партий
- AI Coach с объяснением ошибок
- аккаунт учителя
- аккаунт ученика
- система классов
- заявки учеников на вступление в класс
- приглашения от учителя
- задания для учеников
- отслеживание активности учеников
- отслеживание прогресса по задачам
- история партий
- рейтинг и статистика
- панель учителя
- лидерборд класса

## Возможности учителя

Учитель может:

- создать класс
- пригласить учеников
- принять или отклонить заявку ученика
- выдавать задания
- смотреть активность учеников
- смотреть решенные задачи
- смотреть сыгранные партии
- открывать анализ партий
- отслеживать прогресс учеников
- видеть слабые стороны каждого ученика

## Возможности ученика

Ученик может:

- вступить в класс учителя
- решать назначенные задачи
- играть партии
- проходить уроки
- смотреть свои ошибки
- отслеживать личный прогресс
- получать рекомендации от AI Coach

## Почему это ценно

Эта платформа экономит время шахматного учителя.

Вместо того чтобы проверять задания вручную на бумаге, учитель может открыть панель управления и сразу увидеть прогресс всех учеников.

Ученики тоже получают пользу: они занимаются более структурно, видят свои ошибки, получают задания по уровню и могут быстрее улучшать игру.

## Будущие улучшения

- продвинутые AI-отчеты для учителей
- турниры внутри классов
- отчеты для родителей
- больше шахматных уроков
- больше категорий задач
- онлайн-мультиплеер
- аккаунты для шахматных школ
- PDF-отчеты по прогрессу
- мобильное приложение
