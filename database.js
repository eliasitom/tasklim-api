const dbURI = "mongodb+srv://Eliasito:ckroc123456789@cluster0.5kzub0s.mongodb.net/mini-notes?retryWrites=true&w=majority"
//CUIDADO: estoy imprimiendo mi contraseña por consola, debería usar una plantilla literal e importar mi contraseña de una variable de estado.

const mongoose = require('mongoose')

mongoose.connect(dbURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
    .catch(err => console.log(err)) 

mongoose.connection.once('open', _ => {
    console.log('Database is connected to', dbURI)
})
mongoose.connection.on('error', err => {
    console.log(err)
})