const mongoose = require('mongoose');

const connectionString = process.env.MONGODB_URI;

// Log de las credenciales antes de la conexión
const credentialsMatch = connectionString.match(/\/\/(.*):(.*)@/);
if (credentialsMatch) {
  const username = credentialsMatch[1];
  const password = credentialsMatch[2];
  console.log(`Usuario: ${username}, Contraseña: ${password}`);
}


// Conectarse a MongoDB Atlas
mongoose.connect(process.env.MONGODB_URI);


const db = mongoose.connection;

db.on('error', (error) => {
  console.error('Error de conexión a MongoDB:', error);
});

db.once('open', () => {
  console.log('Conexión exitosa a MongoDB Atlas');
});
