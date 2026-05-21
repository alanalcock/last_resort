import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

async function main() {
  const connectionString = process.env.DATABASE_URL;
  console.log('Testing connection using pg...');
  console.log('Connection URL:', connectionString.replace(/:[^:@]+@/, ':****@')); // Hide password
  
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('Successfully authenticated and connected!');
    const res = await client.query('SELECT current_user, now();');
    console.log('Query result:', res.rows);
  } catch (err) {
    console.error('Connection failed with error:', err.message);
    console.error('Full error details:', err);
  } finally {
    await client.end();
  }
}

main();
