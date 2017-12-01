Feature: Removing files from volumes
    The owner of a volume should be able to remove files from a volume. When deleting their own files, 
    or deleting the volume altogether, files belonging to them should be deleted. However, if they
    delete the volume, files they do not own will not be deleted from their owners. 
    
    Owners of files, even when not owners of the containing volume, should be able to remove their 
    files from the volume. 

    Concepts that are not introduced yet:
    - trash

    Background:
        Given I am logged in
        And I have some contacts
        And I have some files

    @owner 
    Scenario: Remove someone else's file from a volume as owner
        Given I own a volume and have shared it with an editor
        And the editor has uploaded a file to the volume
        When I remove the file from the volume
        Then the file will be removed from the volume
        And my contact will find it in their drive root

    @owner 
    Scenario: Remove my file from a volume as owner
        Given I own a volume and have shared it with an editor
        And I uploaded some files into the volume
        When I remove the file from the volume
        Then the file will be removed from the volume
        And my contact will not see it in their drive

    @owner 
    Scenario: Unshare my file from a volume as owner
        Given I own a volume and have shared it with an editor
        And I uploaded some files into the volume
        When I remove the file from the volume
        Then the file will be removed from the volume
        And my contact will not see it in their drive

    @owner
    Scenario: Delete volume
        Given I own a volume and have shared it with an editor
        And I have uploaded a file to the volume
        And the editor has uploaded a file to the volume
        When I can delete the volume
        Then my file will be deleted
        And the volume will be deleted
        But my contact's file will be in their root
        And it will no longer be shared with the volume

    @editor
    Scenario: Unshare my file from a volume as editor
        Given I am an editor of a volume 
        And I upload a file to a volume
        When I unshare my file from the volume
        Then the file will be unshared from the volume
        And the owner will no longer have access to the file
        And the file will be in the root of my drive

    @editor
    Scenario: Delete my file from a volume as editor
        Given I am an editor of a volume 
        And I upload a file to a volume
        When I delete my file
        Then the file will no longer be in the volume
        And the owner of the volume will no longer have access to the file
        And the file will be deleted

    @editor
    Scenario: Cannot remove someone else's file from a volume as editor
        Given I am an editor of a volume 
        And the volume has a editor
        And the editor has uploaded a file to the volume
        When I remove the editor's file from the volume
        Then I will fail to remove the file from the volume
        And the file will still be in the volume
        And the owner of the volume will see the file in the volume
        And the owner of the file will see the file in the volume

    @editor
    Scenario: Cannot delete a volume as editor
        Given I am an editor of a volume 
        When I delete the volume
        Then I will fail to delete the volume
        And I will still see the volume
        And the owner of the volume will still see the volume

    @viewer
    Scenario: Unshare my file from a volume as viewer
        Given I have uploaded a file
        And I have sent this file to a contact
        And this contact has shared it with me in a volume
        And I am a viewer of this volume
        When I unshare my file from the volume
        Then the file will be unshared from the volume
        And the owner will no longer have access to the file
        And the file will be in the root of my drive

    @viewer
    Scenario: Delete my file from a volume as viewer
        Given I have uploaded a file
        And I have sent this file to a contact
        And this contact has shared it with me in a volume
        And I am a viewer of this volume
        When I delete my file
        Then the file will no longer be in the volume
        And the owner of the volume will no longer have access to the file
        And the file will be deleted

    @viewer
    Scenario: Cannot remove someone else's file from a volume as viewer
        Given I am a viewer of a volume
        And the volume has an editor
        And the editor has uploaded a file to the volume
        When I remove the editor's file from the volume
        Then I will fail to remove the file from the volume
        And the file will still be in the volume
        And the owner of the volume will see the file in the volume
        And the owner of the file will see the file in the volume
    
    @viewer
    Scenario: Cannot delete a volume as viewer
        Given I am a viewer of a volume 
        When I delete the volume
        Then I will fail to delete the volume
        And I will still see the volume
        And the owner of the volume will still see the volume
    