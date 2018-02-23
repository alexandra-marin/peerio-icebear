
Feature: Room management

    Everything related to room create/invite/join/leave etc.

    Possible actions and states to compose scenarios from:
    |     MY ACTION     |   CUCUMBOT's ACTION   |   MY STATE                        |   CUCUMBOT's STATE    |
    |   send invite     |                       |   invite and member exists        |	invite exists       |
    |   recall invite   |	                    |   no invites exist                |   no invites exist    |
    |                   |   reject invite       |   no invite and no member exists  |   no invites exist    |
	|                   |   accept invite	    |   no invite, joined member exists	|   no invite, joined   |
	|                   |   leave	            |   no member exists	            |   no room exists      |
    |   kick		    |                       |   no member exists	            |   no room exists      |
    |   delete room		|                       |   no room exists	                |   no room exists      |

    For offline scenarios, If not specified separately - client is assumed online at the moment of step execution.

    Background:
        Given I create my account
        And   I create a room
        And   I invite Cucumbot to the room

    # online: invite -> accept
    @BOT_room_invite_accept
    Scenario: Invite and accept
        Then  I see the invite I sent
        And   Cucumbot receives the invite
        When  Cucumbot accepts the invite
        Then  I can see Cucumbot joined the room
        And   Cucumbot has joined the room

    # online: invite -> reject
    @BOT_room_invite_reject
    Scenario: Invite and reject
        When  Cucumbot receives the invite
        And   Cucumbot rejects the invite
        Then  The invite sent is removed
        And   Cucumbot's invite is removed
        And   The Cucumbot is not a member of the room

    # online: invite -> recall
    @BOT_room_invite_recall
    Scenario: Invite and recall invite
        When  Cucumbot receives the invite
        And   I recall the invite
        Then  The invite sent is removed
        And   Cucumbot's invite is removed
        And   The Cucumbot is not a member of the room

    # online: invite -> accept -> leave
    @BOT_room_invite_accept_leave
    Scenario: Invite, accept and leave
        When  Cucumbot receives the invite
        And   Cucumbot accepts the invite
        And   Cucumbot leaves the room
        Then  Cucumbot is not in the room anymore
        And   The Cucumbot is not a member of the room

    # online: invite -> accept -> kick
    @BOT_room_invite_accept_kick
    Scenario: Invite, accept and kick
        When  Cucumbot receives the invite
        And   Cucumbot accepts the invite
        And   I kick Cucumbot from the room
        Then  Cucumbot is not in the room anymore
        And   The Cucumbot is not a member of the room

    # TODO: enable after serve bug fix
    # online: invite -> reject -> invite -> accept
    @BOT_room_invite_reject_invite_accept
    @off
    Scenario: Reinvite and accept after one Invite and reject
        When  Cucumbot receives the invite
        And   Cucumbot rejects the invite
        Then  The invite sent is removed
        And   Cucumbot's invite is removed
        When  I invite Cucumbot to the room
        And   Cucumbot receives the invite
        And   Cucumbot accepts the invite
        Then  I can see Cucumbot joined the room
        And   Cucumbot has joined the room

    # online: invite -> recall -> invite -> accept

    # online: invite -> accept -> leave -> invite -> accept

    # online: invite -> accept -> kick -> invite -> accept

    # Smoke test:
    # online: invite -> reject -> invite -> reject -> invite -> recall -> invite -> accept -> kick -> invite ->
    #           reject -> invite -> accept -> leave -> invite -> recall -> invite -> accept -> delete

    # Things to test for offline/restart scenarios
    # - receiving invite while offline
    # - invite persistance after restart
