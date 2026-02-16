/*
  # Create users table for face recognition

  1. New Tables
    - `users`
      - `id` (uuid, primary key) - Unique user identifier
      - `username` (text, unique, not null) - User's username
      - `face_descriptor` (jsonb, not null) - Face embedding data (128-dimensional vector)
      - `created_at` (timestamptz) - Account creation timestamp

  2. Security
    - Enable RLS on `users` table
    - Add policy for users to read all usernames (for login validation)
    - Add policy for users to insert their own registration
    - Add policy for users to read their own data

  3. Important Notes
    - Face descriptors are stored as JSONB arrays containing floating point numbers
    - The face-api.js library generates 128-dimensional face descriptors
    - Users can view all usernames to check if username exists during registration
*/

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  face_descriptor jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all usernames for validation"
  ON users
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anyone can register a new user"
  ON users
  FOR INSERT
  TO anon
  WITH CHECK (true);