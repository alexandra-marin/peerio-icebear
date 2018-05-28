Feature: MedCryptor patient spaces

    @wip
    Scenario: MedCryptor users can create spaces
        Given I create a MedCryptor account
        Then  I create a patient space
        And   I create two internal rooms
        And   I create a patient room
        Then  I can view the patient space
        Then  I get notified of unread messages
        Then  I create another patient space

    # @wip
    # Scenario: MedCryptor users can invite Peerio users to patient rooms
    #     Given I create a MedCryptor account
    #     And   I create a patient space
    #     And   I create a patient room
    #     When  I invite Cucumbot to the patient room
    #     Then  Cucumbot joins the room

    # @wip
    # Scenario: MedCryptor users can invite other Medcryptor users to all rooms in a spaces
    #     Given I create a MedCryptor account
    #     And   I create a patient space
    #     And   I create a patient room
    #     When  I invite Cucumbot to the patient room
    #     Then  Cucumbot joins the room
    #     And   I create two internal rooms
    #     When  I invite Cucumbot to the internal rooms
    #     Then  Cucumbot joins the internal rooms