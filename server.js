const express = require("express");
const app = express();
const PORT = process.env.PORT || 8000;

require("./database");
const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;

const TaskSchema = require("./schemas/TaskSchema");
const NoteSchema = require("./schemas/NoteSchema");
const UserSchema = require("./schemas/UserSchema");
const KanbanSchema = require("./schemas/KanbanSchema")

const cors = require("cors");

const jwt = require('jsonwebtoken');
const SECRET_KEY = require("./privateKeys")
const bodyParser = require('body-parser');


// Middleware

app.use(cors());
app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


//#region AUTHENTICATION & USER_OPTIONS

app.post("/api/signup", async (req, res) => {
  try {
    const { username, password } = req.body

    if (password && username) {
      const newUser = new UserSchema({
        username,
        password
      })

      const savedUser = await newUser.save()
      const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: '24h' });

      res.status(200).json({ token, user: savedUser })
    } else {
      res.status(400).send("Bad request")
    }
  } catch (error) {
    res.status(500).send("internal error has ocurred");
    console.log(error);
  }
})
app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body

    const user = await UserSchema.findOne({ username })

    if (user.password === password) {
      const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: '48h' });

      res.status(200).json({ user, token })
    }
  } catch (error) {
    res.status(500).send("internal error has ocurred");
    console.log(error);
  }
})

app.get("/api/verify_user/:token", async (req, res) => {
  try {
    const token = req.params.token

    jwt.verify(token, SECRET_KEY);
    
  
    res.status(200).json({ message: "valid token" })
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      console.log(error.name)
      res.json({ message: "expired token" })
    } else {
      console.log(error)
      res.json({ message: "invalid token" })
    }
  }
})

app.patch("/api/edit_user", async (req, res) => {
  try {
    const { newUsername, newProfilePicture, userId } = req.body

    const user = await UserSchema.findOne({ _id: userId })

    // Actualizar tareas personales
    const tasks = await TaskSchema.find({ "createdBy.username": user.username })

    tasks.forEach(async elem => {
      elem.createdBy = {
        username: newUsername,
        profilePicture: newProfilePicture
      }
      await elem.save()
    })

    // Actualizar notas personales
    const notes = await NoteSchema.find({ "createdBy.username": user.username })

    notes.forEach(async elem => {
      elem.createdBy = {
        username: newUsername,
        profilePicture: newProfilePicture
      }
      await elem.save()
    })

    // Buscar todos los documentos que contienen el nombre antiguo en la lista de amigos
    const friendsList = await UserSchema.find({
      'friends.username': user.username
    });

    // Iterar sobre los amigos y actualizar username y profilePicture en la lista de amigos
    for (const currentFriend of friendsList) {
      currentFriend.friends.forEach(friend => {
        if (friend.username === user.username) {
          friend.username = newUsername;
          friend.profilePicture = newProfilePicture
        }
      });
      // Iterar sobre los amigos y actualizar el nombre en la lista de notificaciones
      currentFriend.notifications.forEach(notification => {
        if (notification.from === user.username) {
          notification.from = newUsername;
        }
      });
      await currentFriend.save();
    }

    // Iterar sobre los shared kanban y actualizar: 
    // KanbanSchema.createdBy, KanbanSchema.members.username, KanbanSchema.tasks.createdBy y KanbanSchema.tasks.comments.createdBy
    let sharedKanbans = await KanbanSchema.find({
      $or: [
        { createdBy: user.username },
        { 'tasks.createdBy': user.username },
        { 'members.username': user.username }
      ]
    });

    sharedKanbans.forEach(async currentKanban => {
      // KanbanSchema.createdBy
      if (currentKanban.createdBy === user.username) {
        currentKanban.createdBy = newUsername
      }

      // KanbanSchema.tasks.createdBy
      if (currentKanban.tasks.filter(elem => elem.createdBy.username === user.username).length > 0) {
        currentKanban.tasks.map(elem => {
          if (elem.createdBy.username === user.username) {
            elem.createdBy = {
              username: newUsername,
              profilePicture: newProfilePicture
            }
          }
          return elem
        })
      }

      // KanbanSchema.members.username && KanbanSchema.members.profilePicture
      if (currentKanban.members.filter(elem => elem.username === user.username).length > 0) {
        currentKanban.members.map(elem => {
          if (elem.username === user.username) {
            elem.username = newUsername
            elem.profilePicture = newProfilePicture
          }
          return elem
        })
      }

      // KanbanSchema.tasks.comments.createdBy
      currentKanban.tasks.forEach(currentTask => {
        currentTask.comments.forEach(currentComment => {
          if (currentComment.createdBy.username === user.username) {
            currentComment.createdBy.username = newUsername
            currentComment.createdBy.profilePicture = newProfilePicture
          }
        })
      })

      await currentKanban.save()
    })

    // Iterar sobre las notificaciones de user y cambiar "notification.to"
    user.notifications.forEach(notification => {
      if (notification.to === user.username) {
        notification.to === newUsername
      }
    })

    user.username = newUsername
    user.profilePicture = newProfilePicture

    const savedUser = await user.save()

    res.status(200).json({ user: savedUser })
  } catch (error) {
    res.status(500).send("internal error has ocurred");
    console.log(error);
  }
})

app.get("/api/get_users_by_username/:username", async (req, res) => {
  try {
    const username = req.params.username

    // Expresion regular con la variable username
    const regex = new RegExp(username, 'i'); // La 'i' hace que la búsqueda sea insensible a mayúsculas y minúsculas

    const usersFound = await UserSchema.find({ username: regex })

    res.status(200).json({ users: usersFound })
  } catch (error) {
    res.status(500).send("internal error has ocurred");
    console.log(error);
  }
})

app.get("/api/get_user_by_id/:id", async (req, res) => {
  try {
    const userId = req.params.id

    if (userId) {
      const user = await UserSchema.findOne({ _id: userId })

      res.status(200).json({ user })
    }
  } catch (error) {
    res.status(500).send("internal error has ocurred");
    console.log(error);
  }
})

//#endregion

//#region SOCIAL_OPTIONS

app.post("/api/post_notification/friend_request", async (req, res) => {
  // las notificaciones de tipo "friend request" agregan inmediatamente al usuario como amigo, pero el estado es "pendiente",
  // por lo que no se muestra como amigo. Luego de que el otro usuario confirme la solicitud el estado pasa a ser "activo"

  try {
    const notification = req.body

    let senderUser = await UserSchema.findOne({ username: notification.from })
    let target = await UserSchema.findOne({ username: notification.to })


    // En el caso de que ambos se envien la notificacion al mismo tiempo
    // "mismo tiempo" => sin hacer refresh a la pagina
    if (senderUser.notifications.filter(elem =>
      elem.from === target.username && elem.notificationType === "friend request").length === 0) {
      target.notifications.push(notification)

      const newFriendToSender = { username: target.username, profilePicture: target.profilePicture, state: "waiting" }
      const newFriendToTarget = { username: senderUser.username, profilePicture: senderUser.profilePicture, state: "pending" }

      target.friends.push(newFriendToTarget)
      senderUser.friends.push(newFriendToSender)
    }

    await target.save()
    await senderUser.save()

    res.status(200).json({ message: "request received successfully" })
  } catch (error) {
    res.status(500).send("internal error has ocurred");
    console.log(error);
  }
})

app.delete("/api/delete_notification/:userId/:notificationId", async (req, res) => {
  try {
    const { userId, notificationId } = req.params

    let user = await UserSchema.findOne({ _id: userId })

    user.notifications = user.notifications.filter(elem => elem._id.toString() !== notificationId)
    user = await user.save()

    res.status(200).json({ user })

  } catch (error) {
    res.status(500).send("internal error has ocurred");
    console.log(error);
  }
})

app.get("/api/get_notifications/:userId", async (req, res) => {
  try {
    const userId = req.params.userId

    const user = await UserSchema.findOne({ _id: userId })

    res.status(200).json({ notifications: user.notifications })
  } catch (error) {
    res.status(500).send("internal error has ocurred");
    console.log(error);
  }
})

app.delete("/api/deny_friend_request/:notificationOwner/:notificationSender/:notificationId", async (req, res) => {
  try {
    const notificationId = req.params.notificationId
    let notificationOwner = await UserSchema.findOne({ username: req.params.notificationOwner })
    let notificationSender = await UserSchema.findOne({ username: req.params.notificationSender })

    // Paso 1. Eliminar la notificacion
    if (notificationId !== "undefined_notification_id") {
      notificationOwner.notifications =
        notificationOwner.notifications.filter(elem => elem._id.toString() !== notificationId)
    } else {
      notificationOwner.notifications =
        notificationOwner.notifications.filter(elem => {
          if (elem.to !== notificationOwner.username
            || elem.from !== notificationSender.username
            || elem.notificationType !== "friend request") {
            return elem
          }
        })
    }

    // Paso 2. Eliminar de la lista de amigos a notificationOwner de notificationSender y viceversa
    notificationOwner.friends =
      notificationOwner.friends.filter(elem => elem.username !== notificationSender.username)

    notificationSender.friends =
      notificationSender.friends.filter(elem => elem.username !== notificationOwner.username)

    const savedUser = await notificationOwner.save()
    await notificationSender.save()

    res.status(200).json({ user: savedUser })

  } catch (error) {
    res.status(500).send("internal error has ocurred");
    console.log(error);
  }
})

app.post("/api/accept_friend_request/:userId/:friendId/:notificationId", async (req, res) => {
  try {
    const { userId, friendId, notificationId } = req.params

    let user;
    let friend;

    //En el caso de no recibir un Id sino un username
    user = await UserSchema.findOne({ username: userId })
    friend = await UserSchema.findOne({ username: friendId })

    //En el caso de no recibir un username sino un Id
    if (!user) user = await UserSchema.findOne({ _id: userId })
    if (!friend) friend = await UserSchema.findOne({ _id: friendId })



    // Establecer a firiendUsername como amigo activo
    user.friends.forEach(elem => {
      if (elem.username === friend.username) {
        elem.state = "active";
      }
    });


    friend.friends.forEach(elem => {
      if (elem.username === user.username) {
        elem.state = "active";
      }
    });


    //Eliminar la notificacion
    if (notificationId !== "undefined_notification_id") {
      user.notifications =
        user.notifications.filter(elem => elem._id.toString() !== notificationId)
    } else {
      user.notifications =
        user.notifications.filter(elem => {
          if (elem.to !== user.username
            || elem.from !== friend.username
            || elem.notificationType !== "friend request") {
            return elem
          }
        })
    }

    const savedUser = await user.save()
    await friend.save()

    res.status(200).json({ user: savedUser })

  } catch (error) {
    res.status(500).send("internal error has ocurred");
    console.log(error);
  }
})

app.delete("/api/delete_friend/:myUsername/:friendUsername", async (req, res) => {
  try {
    const { myUsername, friendUsername } = req.params

    let myUser = await UserSchema.findOne({ username: myUsername })
    let friendUser = await UserSchema.findOne({ username: friendUsername })

    myUser.friends = myUser.friends.filter(elem => elem.username !== friendUsername)
    friendUser.friends = friendUser.friends.filter(elem => elem.username !== myUsername)

    const savedUser = await myUser.save()
    await friendUser.save()

    res.status(200).json({ savedUser })

  } catch (error) {
    res.status(500).send("internal error has ocurred");
    console.log(error);
  }
})

//#endregion

//#region NOTES
app.post("/api/post_note", async (req, res) => {
  try {
    const { title, body, createdBy } = req.body;

    const note = new NoteSchema({
      title,
      body,
      createdBy
    });

    const savedNote = await note.save();

    res.status(200).json({ note: savedNote });
  } catch (error) {
    res.status(500).send("internal error has ocurred");
    console.log(error);
  }
});

app.get("/api/get_notes/:username", async (req, res) => {
  try {
    const username = req.params.username
    const notes = await NoteSchema.find({ "createdBy.username": username });

    res.status(200).json({ notes });
  } catch (error) {
    res.status(500).send("internal error has ocurred");
    console.log(error);
  }
});

app.post("/api/edit_note", async (req, res) => {
  try {
    const { newTitle, newBody, newColor, noteId } = req.body;

    let note = await NoteSchema.findOne({ _id: noteId });

    note.title = newTitle;
    note.body = newBody;
    note.color = newColor;

    const noteSaved = await note.save();

    res.status(200).json({ note: noteSaved });
  } catch (error) {
    res.status(500).send("internal error has ocurred");
    console.log(error);
  }
});

app.delete("/api/delete_note/:note_id", async (req, res) => {
  try {
    const noteId = req.params.note_id;
    await NoteSchema.deleteOne({ _id: noteId });
    const notes = await NoteSchema.find({});

    res.status(200).json({ notes });
  } catch (error) {
    res.status(500).send("internal error has ocurred");
    console.log(error);
  }
});
//#endregion

//#region TASKS

app.post("/api/post_task", async (req, res) => {
  try {
    const { task, createdBy } = req.body;

    const newTaskSchema = new TaskSchema({ createdBy, body: task });

    const newTask = await newTaskSchema.save();

    res.status(200).json({ newTask });
  } catch (error) {
    res.status(500).send("internal error has ocurred");
    console.log(error);
  }
});

app.get("/api/get_task/:taskId", async (req, res) => {
  try {
    const taskId = req.params.taskId
    const task = await TaskSchema.findById({ _id: taskId });
    res.status(200).json({ task });
  } catch (error) {
    res.status(500).send("internal error has ocurred");
    console.log(error);
  }
});

app.get("/api/get_tasks/:username", async (req, res) => {
  try {
    const username = req.params.username
    const tasks = await TaskSchema.find({ "createdBy.username": username });

    res.status(200).json({ tasks });
  } catch (error) {
    res.status(500).send("internal error has ocurred");
    console.log(error);
  }
})

app.patch("/api/change_task_state", async (req, res) => {
  try {
    const { newTasks, oldTasks } = req.body

    //Comprobar toDo
    newTasks.toDo.forEach(async newTask => {
      if (oldTasks.running.includes(newTask) || oldTasks.completed.includes(newTask)) {
        //El estado de la tarea era diferente a "to-do"
        await TaskSchema.findOneAndUpdate({ _id: newTask }, { $set: { state: "to-do" } })
      }
    })

    //Comprobar running
    newTasks.running.forEach(async newTask => {
      if (oldTasks.toDo.includes(newTask) || oldTasks.completed.includes(newTask)) {
        //El estado de la tarea era diferente a "running"
        await TaskSchema.updateOne({ _id: newTask }, { $set: { state: "running" } })
      }
    })

    //Comprobar completed
    newTasks.completed.forEach(async newTask => {
      if (oldTasks.toDo.includes(newTask) || oldTasks.running.includes(newTask)) {
        //El estado de la tarea era diferente a "completed"
        await TaskSchema.findOneAndUpdate({ _id: newTask }, { $set: { state: "completed" } })
      }
    })

    res.status(200).send("request received")
  } catch (error) {
    res.status(500).send("internal error has ocurred");
    console.log(error);
  }
})

app.delete("/api/delete_task/:id", async (req, res) => {
  try {
    const id = req.params.id

    await TaskSchema.deleteOne({ _id: id })

    res.status(200).send("request received")
  } catch (error) {
    res.status(500).send("internal error has ocurred");
    console.log(error);
  }
})

app.post("/api/edit_task", async (req, res) => {
  try {
    const { newBody, newColor, taskId } = req.body

    const task = await TaskSchema.findOne({ _id: taskId })
    task.color = newColor
    task.body = newBody
    await task.save()

    res.status(200).send("request received")

  } catch (error) {
    res.status(500).send("internal error has ocurred");
    console.log(error);
  }
})

app.post("/api/post_notification/new_kanban", async (req, res) => {
  try {
    const { sender, targets, kanbanData } = req.body

    let userSender = await UserSchema.findOne({ username: sender })
    let userTargets = await Promise.all(targets.map(async current => {
      return await UserSchema.findOne({ username: current });
    }));

    // Enviar notificacion y el kanban a todos los miembros
    userTargets.forEach(async currentTarget => {
      currentTarget.notifications.push({
        from: sender,
        to: currentTarget.username,
        notificationType: "new kanban",
        kanbanName: kanbanData.kanbanName
      })
      currentTarget.sharedKanban.push({
        kanbanName: kanbanData.kanbanName,
        kanbanImage: kanbanData.kanbanImage
      })

      return await currentTarget.save()
    })

    // Agregar el kanban a userSender
    await userSender.sharedKanban.push({
      kanbanName: kanbanData.kanbanName,
      kanbanImage: kanbanData.kanbanImage
    })

    // Guardar documento
    const newKanban = {
      kanbanName: kanbanData.kanbanName,
      kanbanDescription: kanbanData.kanbanDescription,
      kanbanImage: kanbanData.kanbanImage,
      members: kanbanData.members,
      createdBy: kanbanData.createdBy,
      tasks: []
    }

    const newKanbanDoc = new KanbanSchema(newKanban)
    await newKanbanDoc.save()
    const savedUserSender = await userSender.save()

    res.status(200).json({ user: savedUserSender })

  } catch (error) {
    res.status(500).send("internal error has ocurred");
    console.log(error);
  }
})

app.get("/api/get_shared_kanban/:kanbanName", async (req, res) => {
  try {
    const { kanbanName } = req.params

    const kanban = await KanbanSchema.findOne({ kanbanName });

    res.status(200).json({ kanban });
  } catch (error) {
    res.status(500).send("internal error has ocurred");
    console.log(error);
  }
});

app.post("/api/post_shared_task", async (req, res) => {
  try {
    const { task, kanbanName } = req.body;

    // Agregar la tarea al kanban
    const kanban = await KanbanSchema.findOne({ kanbanName })

    kanban.tasks.push(task)
    const savedKanban = await kanban.save()

    const newTask = savedKanban.tasks[savedKanban.tasks.length - 1]

    //Enviar la notificacion a todos los miembros del kanban

    const membersList = kanban.members.map(elem => elem.username)
    const membersUsers = await Promise.all(membersList.map(async current => {
      return await UserSchema.findOne({ username: current });
    }));

    membersUsers.forEach(async member => {
      if (member.username !== task.createdBy.username) {
        const newNotification = {
          from: task.createdBy.username,
          to: member.username,
          notificationType: "new shared task",
          kanbanName
        }

        member.notifications.push(newNotification)
      }

      await member.save()
    })

    res.status(200).json({ newTask })
  } catch (error) {
    res.status(500).send("internal error has ocurred");
    console.log(error);
  }
})
app.delete("/api/delete_shared_task/:taskId/:kanbanName", async (req, res) => {
  try {
    const { taskId, kanbanName } = req.params

    const kanban = await KanbanSchema.findOne({ kanbanName })
    kanban.tasks = kanban.tasks.filter(elem => elem._id.toString() !== taskId)
    await kanban.save()

    res.status(200).send("request received successfully")

  } catch (error) {
    res.status(500).send("internal error has ocurred");
    console.log(error);
  }
})

app.get("/api/get_shared_task/:taskId/:kanbanName", async (req, res) => {
  try {
    const { taskId, kanbanName } = req.params

    const kanban = await KanbanSchema.findOne({ kanbanName })

    const task = kanban.tasks.filter(elem => elem._id.toString() === taskId)[0]

    res.status(200).json({ task })
  } catch (error) {
    res.status(500).send("internal error has ocurred");
    console.log(error);
  }
})

app.patch("/api/change_shared_task_state", async (req, res) => {
  try {
    const { taskId, newState, kanbanName } = req.body

    let kanban = await KanbanSchema.findOne({ kanbanName })
    const taskIndex = kanban.tasks.findIndex(elem => elem._id.toString() === taskId)
    let newTask = kanban.tasks[taskIndex]

    if (newState === "to-do") newTask.state = "to-do"
    else if (newState === "running") newTask.state = "running"
    else newTask.state = "completed"

    kanban.tasks[taskIndex] = newTask

    await kanban.save()

    res.status(200).send("request received")
  } catch (error) {
    res.status(500).send("internal error has ocurred");
    console.log(error);
  }
})

app.post("/api/edit_shared_task", async (req, res) => {
  try {
    const { newBody, newColor, taskId, kanbanName } = req.body

    const kanban = await KanbanSchema.findOne({ kanbanName })

    kanban.tasks.forEach(currentTask => {
      if (currentTask._id.toString() === taskId) {
        currentTask.body = newBody
        currentTask.color = newColor
      }
    })

    await kanban.save()

    res.status(200).send("request received")

  } catch (error) {
    res.status(500).send("internal error has ocurred");
    console.log(error);
  }
})

app.post("/api/post_shared_task_comment", async (req, res) => {
  try {
    const { body, createdBy, kanbanName, taskId } = req.body

    const kanban = await KanbanSchema.findOne({ kanbanName })

    // Crear y guardar el comentario en la respectiva tarea del kanban
    const newComment = {
      createdBy,
      body
    }
    kanban.tasks.forEach(currentTask => {
      if (currentTask._id.toString() === taskId) {
        currentTask.comments.push(newComment)
      }
    })

    const savedKanban = await kanban.save()

    const taskIndex = savedKanban.tasks.findIndex(elem => elem._id.toString() === taskId)
    const savedComment = savedKanban.tasks[taskIndex].comments[savedKanban.tasks[taskIndex].comments.length - 1]

    // Enviar una notificacion a todos los miembros del kanban

    const membersList = kanban.members.map(elem => elem.username)
    const membersUsers = await Promise.all(membersList.map(async current => {
      return await UserSchema.findOne({ username: current });
    }));

    membersUsers.forEach(async member => {
      if (member.username !== createdBy.username) {
        const newNotification = {
          from: createdBy.username,
          to: member.username,
          notificationType: "new task comment",
          kanbanName
        }

        member.notifications.push(newNotification)
      }

      await member.save()
    })

    res.status(200).json({ savedComment })
  } catch (error) {
    res.status(500).send("internal error has ocurred");
    console.log(error);
  }
})

app.delete("/api/delete_shared_task_comment/:kanbanName/:taskId/:commentId", async (req, res) => {
  try {
    const { kanbanName, taskId, commentId } = req.params

    const kanban = await KanbanSchema.findOne({ kanbanName })

    kanban.tasks.forEach(currentTask => {
      if (currentTask._id.toString() === taskId) {
        currentTask.comments = currentTask.comments.filter(currentComment => currentComment._id.toString() !== commentId)
      }
    })
    await kanban.save()

    res.status(200).send("request received successfully")

  } catch (error) {
    res.status(500).send("internal error has ocurred");
    console.log(error);
  }
})

app.post("/api/post_notification/add_kanban_member", async (req, res) => {
  try {
    const { kanbanName, newMember } = req.body

    let kanban = await KanbanSchema.findOne({ kanbanName })
    let newMemberUser = await UserSchema.findOne({ username: newMember })

    // Enviar la notificacion
    const notification = {
      from: kanban.createdBy,
      to: newMember,
      notificationType: "kanban invitation request",
      kanbanName
    }
    newMemberUser.notifications.push(notification)

    // Agregar al usuario como miembro pendiente

    kanban.members.push({
      username: newMember,
      profilePicture: newMemberUser.profilePicture,
      activeMember: false
    })

    //

    const kanbanSaved = await kanban.save()
    await newMemberUser.save()

    res.status(200).json({ kanbanSaved })

  } catch (error) {
    res.status(500).send("internal error has ocurred");
    console.log(error);
  }
})

app.post("/api/accept_kanban_invitation", async (req, res) => {
  try {
    const { kanbanName, newMember, notificationId } = req.body

    let kanban = await KanbanSchema.findOne({ kanbanName })
    let newMemberUser = await UserSchema.findOne({ username: newMember })

    kanban.members = kanban.members.map(elem => {
      if (elem.username === newMember) {
        elem.activeMember = true
      }
      return elem
    })

    newMemberUser.sharedKanban.push({ kanbanName, kanbanImage: kanban.kanbanImage })
    newMemberUser.notifications =
      newMemberUser.notifications.filter(elem => elem._id.toString() !== notificationId)

    await kanban.save()
    const savedMemberUser = await newMemberUser.save()

    res.status(200).json({ userSaved: savedMemberUser })

  } catch (error) {
    res.status(500).send("internal error has ocurred");
    console.log(error);
  }
})

app.delete("/api/deny_kanban_invitation/:kanbanName/:username/:notificationId", async (req, res) => {
  try {
    const { kanbanName, username, notificationId } = req.params

    let kanban = await KanbanSchema.findOne({ kanbanName })
    let user = await UserSchema.findOne({ username })

    kanban.members = kanban.members.filter(elem => elem.username !== username)
    user.notifications = user.notifications.filter(elem => elem._id.toString() !== notificationId)

    await kanban.save()
    await user.save()

    res.status(200).send("request received successfully")

  } catch (error) {
    res.status(500).send("internal error has ocurred");
    console.log(error);
  }
})

app.delete("/api/delete_kanban_member/:username/:kanbanName", async (req, res) => {
  try {
    const { username, kanbanName } = req.params

    let kanban = await KanbanSchema.findOne({ kanbanName })
    let user = await UserSchema.findOne({ username })

    // Actualizar kanban

    kanban.tasks = kanban.tasks.filter(elem => {
      if (elem.createdBy.username !== username) {
        return elem
      }
    })
    kanban.tasks = kanban.tasks.map(task => {
      task.comments = task.comments.filter(comment => comment.createdBy.username !== username)
      return task
    })
    kanban.members = kanban.members.filter(elem => elem.username !== username)

    // Actualizar usuario

    user.sharedKanban = user.sharedKanban.filter(elem => elem.kanbanName !== kanbanName)


    await user.save()
    const kanbanSaved = await kanban.save()

    res.status(200).json({ kanbanSaved })

  } catch (error) {
    res.status(500).send("internal error has ocurred");
    console.log(error);
  }
})

app.delete("/api/delete_kanban/:kanbanName", async (req, res) => {
  try {
    const { kanbanName } = req.params
    const kanban = await KanbanSchema.findOne({ kanbanName })

    // Actualizar miembros
    let membersUsers = await Promise.all(kanban.members.map(async current => {
      return await UserSchema.findOne({ username: current.username });
    }));

    membersUsers.map(async currentUser => {
      currentUser.sharedKanban = currentUser.sharedKanban.filter(elem => elem.kanbanName !== kanbanName)
      currentUser.notifications = currentUser.notifications.filter(elem => {
        if (!elem.kanbanName || elem.kanbanName !== kanbanName) return elem
      })

      await currentUser.save()
    })

    // Eliminar kanban
    await KanbanSchema.deleteOne({ kanbanName })

    res.status(200).send("request received successfully")

  } catch (error) {
    res.status(500).send("internal error has ocurred");
    console.log(error);
  }
})

//#endregion

app.listen(PORT, () => {
  console.log(`server on port ${PORT}...`);
});
