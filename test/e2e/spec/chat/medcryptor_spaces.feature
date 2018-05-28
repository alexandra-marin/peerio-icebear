Feature: MedCryptor patient spaces

    Scenario: MedCryptor users can create spaces
        Given I create a MedCryptor account
        Then  I create a patient space
        And   I create two internal rooms
        And   I create a patient room
        Then  I can view the patient space
        Then  I get notified of unread messages
        Then  I create another patient space

    @BOT_room_invite_patient
    Scenario: MedCryptor users can invite Peerio users to patient rooms
        Given I create a MedCryptor account
        And   I create a patient space
        And   I create a patient room
        When  I invite Cucumbot to the room
        Then  Cucumbot accepts the invite
        And   I can see Cucumbot joined the room
        And   Cucumbot has joined the room

    @BOT_room_invite_doctor
    Scenario: MedCryptor users can invite other Medcryptor users to all rooms in a spaces
        Given I create a MedCryptor account
        And   I create a patient space
        # patient rooms
        When  I create a patient room
        And   I invite Cucumbot to the room
        Then  Cucumbot accepts the invite
        And   I can see Cucumbot joined the room
        And   Cucumbot has joined the room
        # doctor rooms
        When  I create two internal rooms
        And   I invite Cucumbot to the room
        Then  Cucumbot accepts the invite
        And   I can see Cucumbot joined the room
        And   Cucumbot has joined the room