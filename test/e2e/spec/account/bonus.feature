Feature: account storage bonus

    User should be able to perform certain actions to earn storage bonus.

    Background:
        Given I create my account

    Scenario: Receive onboarding bonuses
        Then I have not unlocked any storage
        When I save my account key as PDF document
        Then I unlock 100MB of storage
        When I invite other users and they sign up
        Then I unlock 250MB of storage
        When I confirm the primary email
        Then I unlock 100MB of storage
        When I upload an avatar
        Then I unlock 100MB of storage
        When I create a room
        Then I unlock 100MB of storage
        When I install the mobile app
        Then I unlock 100MB of storage
        When I enable two-step verification
        Then I unlock 100MB of storage
        And  I have received all bonuses


