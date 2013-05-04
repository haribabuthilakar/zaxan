Meteor.startup(function () {
  // Users and Roles

  var charArray = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"];
  var activityArray = ["Dinner", "Lunch", "Booze", "Movie", "Outing", "Coffee", "Bought some stuff"]
  var locationArray = ["Extreme Sports Bar", "Westin", "InOrbit Mall", "Rooftop Garden", "Paradise", "Coffee Day", "Madhapur"]
  var participantStatus = ["Paid", "Not Paid"];
  var userIdArray = [];

  Accounts.onCreateUser(function(options, user) {
    user.role = user.emails[0].address === adminEmail ? "admin" : "user";
    if (options.profile) {
      user.profile = options.profile;
    }
    return user;
  });

  var adminUser; // The _id of the admin user is stored here when we create the admin user below
  if (Meteor.users.find().count() === 0) {
    if (adminEmail && adminPassword) {
      adminUser = Accounts.createUser({email: adminEmail, name: adminName, password: adminPassword});
    }


    
    for (var j = 0; j < numberOfUsersToCreateOnFirstStartup; j++) {
      var userEmailPrefix = charArray[Math.floor(Math.random() * charArray.length) + 0] + charArray[Math.floor(Math.random() * charArray.length) + 0] + charArray[Math.floor(Math.random() * charArray.length) + 0];
      var userEmail = userEmailPrefix + "@example.com";
      var userNameSuffix = charArray[Math.floor(Math.random() * charArray.length) + 0] + charArray[Math.floor(Math.random() * charArray.length) + 0] + charArray[Math.floor(Math.random() * charArray.length) + 0];
      var userName = "User " + userNameSuffix;
      var userPassword = "123456"
      _uid = Accounts.createUser({email: userEmail, name: userName, password: userPassword});
      Meteor.users.update({_id: _uid}, {$set: {name:userName}})
      userIdArray.push(_uid);
    }

  }

  // If the Activities and Participants collections are empty, create some sample activity and participant data
  if ((Activities.find().count() === 0)&&(Participants.find().count() === 0)) {
    for (var i = 0; i < numberOfActivitiesToCreateOnFirstStartup; i++) {
      var activityTitle = activityArray[Math.floor(Math.random() * activityArray.length) + 0];;
      var activityLocation = locationArray[Math.floor(Math.random() * locationArray.length) + 0];
      var activityCost = Math.floor((Math.random()*10000)+1);
      
      var _aid = Activities.insert({activityTitle: activityTitle, activityLocation: activityLocation, activityCost: activityCost, activityCreator: userIdArray[Math.floor(Math.random() * userIdArray.length) + 0], activityCreatedDate: (new Date()).getTime(), lastParticipantNumber: 0, participants: []});
      
      for (var j = 0; j < numberOfParticipantsToCreatePerActivityOnFirstStartup; j++) {
        var _pid = userIdArray[Math.floor(Math.random() * userIdArray.length) + 0];
        var participantName = Meteor.users.findOne({_id: _pid}, {userName: 1, _id: 0}).name;
        var participantCreatedDate = ((new Date()).getTime());
        var balPaid = activityCost;
        var participantPaid = (j == numberOfParticipantsToCreatePerActivityOnFirstStartup -1)? balPaid : Math.floor((Math.random()*balPaid)+1);
        balPaid = balPaid - participantPaid;
        var balCost = activityCost;
        var participantCost = (j == numberOfParticipantsToCreatePerActivityOnFirstStartup -1)? balCost : Math.floor((Math.random()*balCost)+1);
        balCost = balCost - participantCost;
        var randomParticipantStatus = Math.floor(Math.random() * participantStatus.length) + 0;
        
        Participants.insert({_aid: _aid, _pid: _pid, participantNumber: 0, participantName: participantName, participantPaid: participantPaid, participantCost: participantCost, participantStatus: participantStatus[randomParticipantStatus], participantCreatedDate: participantCreatedDate});
        Activities.update(_aid, {$addToSet: {participants: {_id: _pid}}})
      }
      
      var participantNumber = 1;
      var activityParticipants = Participants.find({_aid: _aid}, {sort: {participantCreatedDate: 1}});
      activityParticipants.forEach(function (participant) {
        Participants.update(participant._id, {$set: {participantNumber: participantNumber}});
        participantNumber++;
      });
      Activities.update(_aid, {$set: {lastParticipantNumber: (participantNumber - 1)}});
      
      if (adminUser) Activities.update(_aid, {$addToSet: {participants: {_id: adminUser}}});
    }
  }
});