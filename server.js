const express = require('express');
const morgan = require('morgan');
const mysql = require('mysql2');
const cors = require('cors');
const dotenv = require('dotenv');
const app = express();

dotenv.config();

const db = mysql.createConnection({
  host: process.env.DB_HOST ,
  user: process.env.DB_USER ,
  password: process.env.DB_PASSWORD ,
  database: process.env.DB_DATABASE 
});

db.connect((err) => {
  if (err) {
    console.error('Error connecting to the database:', err);
    return;
  }
  console.log('Connected to the database');
});

app.use(morgan('dev'));
app.use(cors());
app.use(express.json());

// Root endpoint
app.get('/', (req, res) => {
  res.send('API is running');
});

app.get('/api/work-status-count', (req, res) => {
  const query = `
    SELECT
      designation,
      COUNT(*) as count
    FROM users_assessments
    GROUP BY designation;
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error('Error executing query:', err);
      return res.status(500).json({ error: 'Database query failed', details: err.message });
    }

    const data = results.map((row) => ({
      status: row.designation,
      count: row.count
    }));

    res.json(data);
  });
});


app.get('/api/score-count-completed', (req, res) => {
  // Step 1: Get the IDs of all completed assessments
  const queryCompletedAssessments = `
    SELECT id FROM users_assessments
    WHERE status = 'complete';
  `;

  db.query(queryCompletedAssessments, (err, completedAssessments) => {
    if (err) {
      console.error('Error executing query:', err);
      return res.status(500).json({ error: 'Database query failed', details: err.message });
    }

    if (completedAssessments.length === 0) {
      return res.status(404).json({ message: 'No completed assessments found.' });
    }

    // Step 2: Extract the IDs and create a comma-separated list
    const completedIds = completedAssessments.map(assessment => assessment.id).join(',');

    // Step 3: Query to get the score and count occurrences from users_assessments_82_variables
    const queryScoreCount = `
      SELECT variable, COUNT(variable) as variable_count
      FROM users_assessments_82_variables
      WHERE user_assessment_id IN (${completedIds})
      GROUP BY variable
      ORDER BY variable_count DESC;
    `;

    db.query(queryScoreCount, (err, scores) => {
      if (err) {
        console.error('Error executing score query:', err);
        return res.status(500).json({ error: 'Score query failed', details: err.message });
      }

      // Step 4: Return the variables, scores, and their counts
      res.json(scores);
    });
  });
});

app.get('/api/score-count/:variable', (req, res) => {
  const variable = req.params.variable;
  const queryCompletedAssessments = `
    SELECT id FROM users_assessments
    WHERE status = 'complete';
  `;

  db.query(queryCompletedAssessments, (err, completedAssessments) => {
    if (err) {
      console.error('Error executing query:', err);
      return res.status(500).json({ error: 'Database query failed', details: err.message });
    }

    if (completedAssessments.length === 0) {
      return res.status(404).json({ message: 'No completed assessments found.' });
    }

    const completedIds = completedAssessments.map(assessment => assessment.id).join(',');

    const queryScoreCount = `
      SELECT score, COUNT(score) as score_count
      FROM users_assessments_82_variables
      WHERE user_assessment_id IN (${completedIds}) AND variable = ?
      GROUP BY score
      ORDER BY score;
    `;

    db.query(queryScoreCount, [variable], (err, scores) => {
      if (err) {
        console.error('Error executing query:', err);
        return res.status(500).json({ error: 'Score query failed', details: err.message });
      }

      const scoreObject = scores.reduce((acc, scoreRow) => {
        acc[scoreRow.score] = scoreRow.score_count;
        return acc;
      }, {});

      res.json(scoreObject);
    });
  });
});


app.get('/api/score-count-all-variables', (req, res) => {
  const queryCompletedAssessments = `
    SELECT id FROM users_assessments
    WHERE status = 'complete';
  `;

  db.query(queryCompletedAssessments, (err, completedAssessments) => {
    if (err) {
      console.error('Error executing query:', err);
      return res.status(500).json({ error: 'Database query failed', details: err.message });
    }

    if (completedAssessments.length === 0) {
      return res.status(404).json({ message: 'No completed assessments found.' });
    }

    const completedIds = completedAssessments.map(assessment => assessment.id).join(',');

    // Query to get score counts for all variables
    const queryScoreCountAll = `
      SELECT variable, score, COUNT(score) as score_count
      FROM users_assessments_82_variables
      WHERE user_assessment_id IN (${completedIds})
      GROUP BY variable, score
      ORDER BY variable, score;
    `;

    db.query(queryScoreCountAll, (err, scoreData) => {
      if (err) {
        console.error('Error executing query:', err);
        return res.status(500).json({ error: 'Score query failed', details: err.message });
      }

      // Process the data to create the required object structure
      const result = scoreData.reduce((acc, row) => {
        const { variable, score, score_count } = row;
        if (!acc[variable]) {
          acc[variable] = {};
        }
        acc[variable][score] = score_count;
        return acc;
      }, {});

      res.json(result);
    });
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`API is running on http://localhost:${PORT}`);
});
