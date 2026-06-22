Game Flow (Simple)

User answers
→ Client sends answer to server

→ Server:

checks answer
updates progress
decides next game + word

→ Server sends back:
{ gameType, data }

→ Client:

picks component from gameMap
renders next game
Rules

Client = UI only
Server = brain

Client never decides what’s next
Server never sends components
