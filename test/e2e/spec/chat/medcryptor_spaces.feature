Feature: MedCryptor patient spaces

    # Any user can be invited all rooms in a space
    # If this changes, update Cucumbot to be either Peerio/MC user

    Background:
        Given I create a MedCryptor account
        And  I create a patient space

    Scenario: MedCryptor users can create spaces
        And   I create two internal rooms
        And   I create a patient room
        Then  I can view the patient space
        Then  I create another patient space

    @BOT_room_invite_patient
    Scenario: MedCryptor users can invite Peerio users to patient rooms
        And   I create a patient room
        When  I invite Cucumbot to the room
        Then  Cucumbot accepts the invite
        And   I can see Cucumbot joined the room
        And   Cucumbot has joined the room

    @BOT_room_invite_doctor
    Scenario: MedCryptor users can invite other Medcryptor users to all rooms in a spaces
        # patient rooms
        When  I create a patient room
        And   I invite Cucumbot to the room
        Then  Cucumbot accepts the invite
        And   I can see Cucumbot joined the room
        And   Cucumbot has joined the room
        When  Cucumbot sends a message "Hello"
        # doctor rooms
        When  I create two internal rooms
        And   I invite Cucumbot to the room
        Then  Cucumbot accepts the invite
        And   I can see Cucumbot joined the room
        And   Cucumbot has joined the room
        When  Cucumbot sends a message "Hello"
        Then  I get notified of unread messages
        